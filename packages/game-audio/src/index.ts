export type Sound =
  | 'dice-roll'
  | 'reel-spin'
  | 'coins-up'
  | 'coins-down'
  | 'click'
  | 'select'
  | 'close'
  | 'enter'
  | 'success'
  | 'harvest'
  | 'error';
export type AudioState = { enabled: boolean; status: 'waiting' | 'loading' | 'playing' | 'muted' | 'unavailable' };
const STORAGE_KEY = 'chibi-town.map.sound.v1';
const ZONE_NOTES: Record<string, number> = {
  farm: 72,
  forest: 69,
  school: 76,
  center: 79,
  fun: 81,
  homes: 74,
  port: 67,
  airport: 77,
};

/** Audio belongs to the app lifecycle, independently of the silent Phaser renderer. */
export function createGameAudio(options: {
  musicUrl: string;
  loopSeconds: number;
  musicEnabled?: boolean;
  onState: (state: AudioState) => void;
}) {
  let enabled = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Storage may be blocked; sound still works for this visit.
  }
  let musicVolume = 0.24,
    effectsVolume = 0.32;
  try {
    const stored = JSON.parse(localStorage.getItem('chibi-town.audio.levels.v1') ?? '{}');
    if (typeof stored.music === 'number' && stored.music >= 0 && stored.music <= 1) musicVolume = stored.music;
    if (typeof stored.effects === 'number' && stored.effects >= 0 && stored.effects <= 1)
      effectsVolume = stored.effects;
  } catch {}
  let track = {
    musicUrl: options.musicUrl,
    loopSeconds: options.loopSeconds,
    musicEnabled: options.musicEnabled ?? true,
  };
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const offsets = new Map<string, number>();
  let sourceGain: GainNode | undefined;
  let status: AudioState['status'] = enabled ? 'waiting' : 'muted';
  let context: AudioContext | undefined;
  let musicGain: GainNode | undefined;
  let effectGain: GainNode | undefined;
  let buffer: AudioBuffer | undefined;
  let loading: Promise<AudioBuffer> | undefined;
  let music: AudioBufferSourceNode | undefined;
  let startedAt = 0;
  let offset = 0;
  let unlocked = false;
  let disposed = false;
  const listeners = new Set<(state: AudioState) => void>();

  const notify = () => {
    const state = { enabled, status };
    options.onState(state);
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  const stopMusic = (fadeSeconds = 0) => {
    if (!music || !context) return;
    offset = (offset + context.currentTime - startedAt) % Math.min(track.loopSeconds, music.buffer!.duration);
    offsets.set(track.musicUrl, offset);
    const previous = music;
    const fade = sourceGain!;
    if (fadeSeconds > 0 && context.state === 'running') {
      fade.gain.cancelScheduledValues(context.currentTime);
      fade.gain.setValueAtTime(fade.gain.value, context.currentTime);
      fade.gain.linearRampToValueAtTime(0, context.currentTime + fadeSeconds);
      previous.onended = () => {
        previous.disconnect();
        fade.disconnect();
      };
      previous.stop(context.currentTime + fadeSeconds);
    } else {
      previous.stop();
      previous.disconnect();
      fade.disconnect();
    }
    music = undefined;
    sourceGain = undefined;
  };

  const startMusic = () => {
    if (music || !buffer || !context || !musicGain || disposed || !enabled || !track.musicEnabled || document.hidden)
      return;
    if (context.state !== 'running') return;
    music = context.createBufferSource();
    music.buffer = buffer;
    music.loop = true;
    music.loopEnd = Math.min(track.loopSeconds, buffer.duration);
    sourceGain = context.createGain();
    music.connect(sourceGain);
    sourceGain.connect(musicGain);
    startedAt = context.currentTime;
    musicGain.gain.value = musicVolume;
    sourceGain.gain.setValueAtTime(0, startedAt);
    sourceGain.gain.linearRampToValueAtTime(1, startedAt + 1.2);
    music.start(0, offset);
    status = 'playing';
    notify();
  };

  async function unlock() {
    const requestedTrack = track;
    if (disposed || !enabled || document.hidden) return;
    try {
      if (!context) {
        context = new AudioContext();
        musicGain = context.createGain();
        musicGain.connect(context.destination);
        effectGain = context.createGain();
        effectGain.gain.value = effectsVolume;
        effectGain.connect(context.destination);
      }
      // resume is invoked directly in the gesture, before any asset-loading await.
      await context.resume();
      if (disposed || !enabled || document.hidden || context.state !== 'running') return;
      unlocked = true;
      if (requestedTrack !== track) {
        void unlock();
        return;
      }
      if (!requestedTrack.musicEnabled) {
        status = 'playing';
        notify();
        return;
      }
      if (!buffer) {
        status = 'loading';
        notify();
        if (!buffers.has(requestedTrack.musicUrl)) {
          const url = requestedTrack.musicUrl;
          buffers.set(
            url,
            fetch(url)
              .then(async (response) => {
                if (!response.ok) throw new Error('Music unavailable');
                return context!.decodeAudioData(await response.arrayBuffer());
              })
              .catch((error) => {
                buffers.delete(url);
                throw error;
              }),
          );
        }
        loading ??= buffers.get(requestedTrack.musicUrl)!;
        const decoded = await loading;
        if (requestedTrack !== track || disposed) return;
        buffer = decoded;
      }
      startMusic();
    } catch {
      if (disposed || requestedTrack !== track) return;
      loading = undefined;
      status = enabled ? 'unavailable' : 'muted';
      notify();
    }
  }

  function play(sound: Sound, zone?: string) {
    if (disposed || !enabled || document.hidden) return;
    void unlock();

    const playPhrase = () => {
      if (disposed || !enabled || document.hidden || !context || !effectGain || context.state !== 'running') return;
      const base = ZONE_NOTES[zone ?? ''] ?? 76;
      // Briefly lower music so short UI tones stay clear without a harsh peak.
      if (music && musicGain) {
        const now = context.currentTime;
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(musicVolume * 0.42, now + 0.025);
        musicGain.gain.linearRampToValueAtTime(musicVolume, now + 0.48);
      }
      if (sound === 'dice-roll' || sound === 'reel-spin') {
        const now = context.currentTime;
        const ticks = sound === 'dice-roll' ? 13 : 25;
        for (let index = 0; index < ticks; index++) {
          const at = now + (sound === 'dice-roll' ? index * 0.095 : index * 0.065);
          const source = context.createBufferSource();
          const noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.045), context.sampleRate);
          const samples = noise.getChannelData(0);
          for (let sample = 0; sample < samples.length; sample++)
            samples[sample] = (Math.random() * 2 - 1) * (1 - sample / samples.length);
          source.buffer = noise;
          const filter = context.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = sound === 'dice-roll' ? 900 + (index % 3) * 500 : 1700;
          const gain = context.createGain();
          gain.gain.setValueAtTime(0.32, at);
          gain.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
          source.connect(filter);
          filter.connect(gain);
          gain.connect(effectGain);
          source.start(at);
          source.onended = () => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
          };
        }
        if (sound === 'dice-roll') return;
      }
      const phrase =
        sound === 'coins-up'
          ? [84, 88, 91, 96]
          : sound === 'coins-down'
            ? [67, 62, 55]
            : sound === 'reel-spin'
              ? [64, 67, 72, 76, 79, 84]
              : sound === 'success'
                ? [76, 79, 84]
                : sound === 'harvest'
                  ? [79, 84]
                  : sound === 'error'
                    ? [60, 57]
                    : sound === 'select'
                      ? [base, base + 4, base + 7]
                      : sound === 'enter'
                        ? [72, 76, 79, 84]
                        : sound === 'close'
                          ? [76, 72]
                          : [81];
      phrase.forEach((midi, index) => {
        const at = context!.currentTime + index * 0.055;
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.4, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
        oscillator.connect(gain);
        gain.connect(effectGain!);
        oscillator.start(at);
        oscillator.stop(at + 0.2);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    };

    if (context?.state === 'running') playPhrase();
    else
      void context
        ?.resume()
        .then(playPhrase)
        .catch(() => {});
  }

  const onVisibility = () => {
    if (document.hidden) {
      stopMusic();
      void context?.suspend().catch(() => {});
    } else if (unlocked && enabled) {
      void unlock();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  notify();
  return {
    unlock,
    play,

    setMusic(next: { musicUrl: string; loopSeconds: number; musicEnabled?: boolean }) {
      const musicEnabled = next.musicEnabled ?? true;
      if (
        disposed ||
        (next.musicUrl === track.musicUrl &&
          next.loopSeconds === track.loopSeconds &&
          musicEnabled === track.musicEnabled)
      )
        return;
      stopMusic(0.25);
      track = { ...next, musicEnabled };
      buffer = undefined;
      loading = undefined;
      offset = offsets.get(track.musicUrl) ?? 0;
      status = enabled ? 'waiting' : 'muted';
      notify();
      if (unlocked && enabled && !document.hidden) void unlock();
    },

    subscribe(listener: (state: AudioState) => void) {
      listeners.add(listener);
      listener({ enabled, status });
      return () => {
        listeners.delete(listener);
      };
    },

    get enabled() {
      return enabled;
    },

    get volumes() {
      return { music: musicVolume, effects: effectsVolume };
    },

    setVolume(channel: 'music' | 'effects', value: number) {
      if (!Number.isFinite(value)) return;
      const volume = Math.max(0, Math.min(1, value));
      if (channel === 'music') {
        musicVolume = volume;
        if (musicGain && context) {
          musicGain.gain.cancelScheduledValues(context.currentTime);
          musicGain.gain.setValueAtTime(volume, context.currentTime);
        }
      } else {
        effectsVolume = volume;
        if (effectGain) effectGain.gain.value = volume;
      }
      try {
        localStorage.setItem(
          'chibi-town.audio.levels.v1',
          JSON.stringify({ music: musicVolume, effects: effectsVolume }),
        );
      } catch {}
    },

    toggle() {
      if (enabled && (status === 'waiting' || status === 'unavailable')) {
        void unlock();
        return;
      }
      enabled = !enabled;
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
      } catch {}
      if (enabled) {
        status = 'waiting';
        void unlock();
      } else {
        stopMusic();
        void context?.suspend().catch(() => {});
        status = 'muted';
      }
      notify();
    },

    destroy() {
      disposed = true;
      listeners.clear();
      document.removeEventListener('visibilitychange', onVisibility);
      stopMusic();
      void context?.close().catch(() => {});
    },
  };
}
