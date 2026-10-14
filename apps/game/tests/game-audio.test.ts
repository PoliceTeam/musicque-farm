import { type AudioState, createGameAudio } from '@chibi-town/game-audio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreenRouter } from '@/application/screen-router';

function fakeContext() {
  const sources: ReturnType<typeof source>[] = [];

  const source = () => ({
    buffer: undefined,
    loop: false,
    loopEnd: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });

  const context = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),

    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),

    decodeAudioData: vi.fn(async () => ({ duration: 76.8 })),
    createBufferSource: vi.fn(() => {
      const node = source();
      sources.push(node);
      return node;
    }),
    createOscillator: vi.fn(() => ({
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined,
    })),
  };
  return { context, sources };
}

describe('shared game audio lifecycle', () => {
  let ctx: ReturnType<typeof fakeContext>;
  let hidden: boolean;
  let visibility: (() => void) | undefined;
  let preference: string | null;
  let states: AudioState[];

  const create = () =>
    createGameAudio({
      musicUrl: '/music.mp3',
      loopSeconds: 76.8,

      onState: (state) => states.push(state),
    });

  beforeEach(() => {
    ctx = fakeContext();
    hidden = false;
    preference = null;
    states = [];
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx.context),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,

        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    vi.stubGlobal('localStorage', {
      getItem: () => preference,

      setItem: (_key: string, value: string) => {
        preference = value;
      },
    });
    vi.stubGlobal('document', {
      get hidden() {
        return hidden;
      },

      addEventListener: (_event: string, handler: () => void) => {
        visibility = handler;
      },

      removeEventListener: () => {
        visibility = undefined;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps one music source alive while screens subscribe, leave and re-enter', async () => {
    const audio = create();
    await audio.unlock();
    const router = createScreenRouter({
      async load() {
        return {
          styles: '',

          mount: () => audio.subscribe(() => {}),
        };
      },

      prepare() {},

      onError(error) {
        throw error;
      },
    });
    await router.open('/map');
    await router.open('/farm');
    await router.open('/character');
    await router.open('/map');
    router.destroy();
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].stop).not.toHaveBeenCalled();
    expect(ctx.context.close).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
    audio.destroy();
    expect(ctx.sources[0].stop).toHaveBeenCalledOnce();
  });

  it('switches farm music with a fade and reuses decoded tracks without losing volume or position', async () => {
    const audio = create();
    audio.setVolume('music', 0.15);
    await audio.unlock();
    ctx.context.currentTime = 9;
    audio.setMusic({ musicUrl: '/farm.mp3', loopSeconds: 48 });
    await audio.unlock();
    expect(ctx.sources[0].stop).toHaveBeenCalledWith(9.25);
    expect(ctx.sources[1].loopEnd).toBe(48);
    ctx.context.currentTime = 15;
    audio.setMusic({ musicUrl: '/music.mp3', loopSeconds: 76.8 });
    await audio.unlock();
    expect(ctx.sources[2].start).toHaveBeenCalledWith(0, 9);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(AudioContext).toHaveBeenCalledOnce();
    expect(audio.volumes.music).toBe(0.15);
    audio.destroy();
  });

  it('stops background music in arcade, keeps effects and restores music on leaving', async () => {
    const audio = create();
    await audio.unlock();
    const volumes = audio.volumes;
    audio.setMusic({ musicUrl: '/music.mp3', loopSeconds: 76.8, musicEnabled: false });
    await audio.unlock();
    expect(ctx.sources[0].stop).toHaveBeenCalledOnce();
    expect(ctx.sources).toHaveLength(1);
    audio.play('success');
    expect(ctx.context.createOscillator).toHaveBeenCalled();
    expect(audio.enabled).toBe(true);
    expect(audio.volumes).toEqual(volumes);
    expect(fetch).toHaveBeenCalledOnce();
    audio.setMusic({ musicUrl: '/music.mp3', loopSeconds: 76.8 });
    await audio.unlock();
    expect(ctx.sources).toHaveLength(2);
    expect(fetch).toHaveBeenCalledOnce();
    audio.destroy();
  });

  it('ignores the previous track when its download completes after switching to farm', async () => {
    let resolve!: (value: { duration: number }) => void;
    ctx.context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const audio = create();
    const previous = audio.unlock();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    audio.setMusic({ musicUrl: '/farm.mp3', loopSeconds: 48 });
    await audio.unlock();
    resolve({ duration: 76.8 });
    await previous;
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].loopEnd).toBe(48);
    expect(states.at(-1)?.status).toBe('playing');
    audio.destroy();
  });

  it('changing the farm track while muted keeps audio disabled until the user enables it', async () => {
    preference = 'off';
    const audio = create();
    audio.setMusic({ musicUrl: '/farm.mp3', loopSeconds: 48 });
    await audio.unlock();
    expect(AudioContext).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(audio.enabled).toBe(false);
    audio.toggle();
    await audio.unlock();
    expect(fetch).toHaveBeenCalledWith('/farm.mp3');
    expect(ctx.sources[0].loopEnd).toBe(48);
    audio.destroy();
  });

  it('waits for interaction and shares one loop across concurrent gestures', async () => {
    const audio = create();
    expect(AudioContext).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    await Promise.all([audio.unlock(), audio.unlock(), audio.unlock()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].loop).toBe(true);
    expect(ctx.sources[0].loopEnd).toBe(76.8);
    expect(states.at(-1)?.status).toBe('playing');
    audio.destroy();
  });

  it('remembers mute and never initializes audio while muted', async () => {
    preference = 'off';
    const audio = create();
    await audio.unlock();
    expect(AudioContext).not.toHaveBeenCalled();
    audio.toggle();
    await audio.unlock();
    expect(ctx.sources).toHaveLength(1);
    audio.toggle();
    expect(preference).toBe('off');
    expect(ctx.sources[0].stop).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe('muted');
    audio.destroy();
  });

  it('pauses in a hidden tab and resumes from the same musical position', async () => {
    const audio = create();
    await audio.unlock();
    ctx.context.currentTime = 13;
    hidden = true;
    visibility!();
    await audio.unlock();
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.context.suspend).toHaveBeenCalled();
    hidden = false;
    visibility!();
    await audio.unlock();
    expect(ctx.sources[1].start).toHaveBeenCalledWith(0, 13);
    audio.destroy();
  });

  it('does not start a buffer that finishes loading after mute', async () => {
    let resolve!: (value: { duration: number }) => void;
    ctx.context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const audio = create();
    const pending = audio.unlock();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    audio.toggle();
    resolve({ duration: 76.8 });
    await pending;
    expect(ctx.sources).toHaveLength(0);
    expect(states.at(-1)?.status).toBe('muted');
    audio.destroy();
  });

  it('can retry a failed download without an unhandled rejection', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'));
    const audio = create();
    await audio.unlock();
    expect(states.at(-1)?.status).toBe('unavailable');
    await audio.unlock();
    expect(states.at(-1)?.status).toBe('playing');
    audio.destroy();
  });

  it('plays the first selection sound before music loads and silences effects when muted', async () => {
    let resolve!: (value: { duration: number }) => void;
    ctx.context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const audio = create();
    audio.play('select', 'airport');
    await vi.waitFor(() => expect(ctx.context.createOscillator).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(resolve).toBeDefined());
    audio.toggle();
    audio.play('select', 'farm');
    expect(ctx.context.createOscillator).toHaveBeenCalledTimes(3);
    resolve({ duration: 76.8 });
    await audio.unlock();
    audio.destroy();
  });

  it('keeps music and effects independent, clamps volume and remembers both', () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,

      setItem: (key: string, value: string) => stored.set(key, value),
    });
    const audio = create();
    audio.setVolume('music', 0.1);
    audio.setVolume('effects', 0.8);
    expect(audio.volumes).toEqual({ music: 0.1, effects: 0.8 });
    audio.setVolume('music', -2);
    audio.setVolume('effects', 2);
    audio.setVolume('music', Number.NaN);
    expect(audio.volumes).toEqual({ music: 0, effects: 1 });
    const restored = create();
    expect(restored.volumes).toEqual({ music: 0, effects: 1 });
    expect(restored.enabled).toBe(true);
    audio.destroy();
    restored.destroy();
  });

  it('cleans up the context and ignores a late load after disposal', async () => {
    let resolve!: (value: { duration: number }) => void;
    ctx.context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const audio = create();
    const pending = audio.unlock();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    audio.destroy();
    resolve({ duration: 76.8 });
    await pending;
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
    expect(visibility).toBeUndefined();
  });
});
