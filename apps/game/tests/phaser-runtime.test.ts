import type { RendererOptions } from '@chibi-town/render-contracts/renderer-types';
import { createPhaserProvider } from '@chibi-town/renderer-phaser/phaser-provider';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

type TimerConfig = { delay: number; loop: boolean; callback(): void };
type GameFixture = {
  scale: { refresh: Mock; resize: Mock; setZoom: Mock };
  destroy: Mock;
};
type SceneFixture = {
  game: GameFixture;
  create(): void;
  update(now: number, delta: number): void;
  scene: { pause: Mock; resume: Mock };
  add: { particles: Mock; graphics: Mock };
  tweens: { add: Mock };
  time: { addEvent: Mock<(config: TimerConfig) => TimerConfig & { elapsed: number }> };
};
type ConfigFixture = { scene: SceneFixture[]; input: unknown; canvas?: HTMLCanvasElement };
type ObserverFixture = { callback(): void; observe: Mock; disconnect: Mock };
const runtime = vi.hoisted(() => ({
  config: undefined as unknown as ConfigFixture,
  game: undefined as unknown as GameFixture,
  observer: undefined as unknown as ObserverFixture,
}));
vi.mock('phaser', async () => {
  const { EventEmitter } = await import('node:events');
  class Graphic {
    alpha = 1;
    x = 0;

    fillStyle() {
      return this;
    }

    fillRect = vi.fn(() => this);

    clear() {
      return this;
    }

    setPosition = vi.fn(() => this);

    setDepth() {
      return this;
    }

    setScrollFactor() {
      return this;
    }

    destroy = vi.fn();
  }
  class Scene {
    game!: GameFixture;
    textures = { exists: () => true };
    add = {
      graphics: vi.fn(() => new Graphic()),
      particles: vi.fn((_x, _y, _texture, config) => ({
        config,
        destroy: vi.fn(),
        setFrequency: vi.fn(),
        setDepth: vi.fn(),
      })),
    };
    tweens = { add: vi.fn((config) => ({ config, remove: vi.fn() })) };
    events = new EventEmitter();
    scene = { pause: vi.fn(), resume: vi.fn() };
    cameras = {
      main: {
        setOrigin: () => this.cameras.main,

        setZoom: () => this.cameras.main,
      },
    };
    time = { addEvent: vi.fn((config: TimerConfig) => ({ ...config, elapsed: 0 })) };
  }
  class Game {
    canvas = {};
    renderer = { type: 2 };
    scale = { refresh: vi.fn(), resize: vi.fn(), setZoom: vi.fn() };
    destroy = vi.fn();

    constructor(config: ConfigFixture) {
      runtime.config = config;
      runtime.game = this;
      config.scene[0].game = this;
    }
  }
  return {
    default: {
      Scene,
      Game,
      AUTO: 0,
      WEBGL: 2,
      Scale: { FIT: 3, NONE: 0 },
      Math: { FloatBetween: (a: number, b: number) => (a + b) / 2 },
      Utils: { Array: { GetRandom: (values: unknown[]) => values[0] } },
      Display: {
        Color: {
          HexStringToColor: () => ({ color: 0xffffff }),

          HSLToColor: () => ({ color: 0xffffff }),
        },
      },
    },
  };
});

afterEach(() => vi.unstubAllGlobals());

function options(): RendererOptions {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(public callback: () => void) {
        runtime.observer = this;
      }
    },
  );
  return {
    parent: {} as HTMLElement,
    width: 480,
    height: 300,
    zoom: 2,
    renderScale: 2,
    fitParent: true,
    backgroundColor: '#75af51',
    onFrame: vi.fn(),
    onReady: vi.fn(),
    fixedStep: { interval: 90, onTick: vi.fn() },
  };
}

describe('Phaser runtime ownership', () => {
  it('uses the scene clock, pauses/resumes through Phaser and disposes parent sizing once', () => {
    const config = options();
    const renderer = createPhaserProvider(config);
    expect(runtime.config).toMatchObject({ width: 960, height: 600, scale: { mode: 3 }, input: { keyboard: false } });
    renderer.setActive(false);
    const scene = runtime.config.scene[0];
    scene.create();
    expect(scene.scene.pause).toHaveBeenCalledOnce();
    const ticker = scene.time.addEvent.mock.results[0].value;
    expect(ticker).toMatchObject({ delay: 90, loop: true });
    ticker.callback();
    scene.update(100, 16);
    expect(config.onFrame).not.toHaveBeenCalled();
    expect(config.fixedStep!.onTick).not.toHaveBeenCalled();
    renderer.setActive(true);
    expect(scene.scene.resume).toHaveBeenCalledOnce();
    ticker.callback();
    scene.update(116, 16);
    expect(config.fixedStep!.onTick).toHaveBeenCalledOnce();
    expect(config.onFrame).toHaveBeenCalledWith(renderer, expect.any(Number), 16);
    ticker.elapsed = 45;
    renderer.setActive(false);
    expect(ticker.elapsed).toBe(0);
    runtime.observer.callback();
    expect(runtime.game.scale.refresh).toHaveBeenCalledOnce();
    renderer.destroy();
    renderer.destroy();
    runtime.observer.callback();
    ticker.callback();
    expect(runtime.observer.disconnect).toHaveBeenCalledOnce();
    expect(runtime.game.scale.refresh).toHaveBeenCalledOnce();
    expect(runtime.game.destroy).toHaveBeenCalledOnce();
    expect(config.fixedStep!.onTick).toHaveBeenCalledOnce();
  });

  it('scopes keyboard capture to the game host and enables mouse and touch only for gameplay', () => {
    const config = options();
    config.input = { onPointerDown: vi.fn() };
    const renderer = createPhaserProvider(config);
    expect(runtime.config.input).toMatchObject({
      keyboard: { target: config.parent },
      mouse: true,
      touch: true,
      gamepad: false,
    });
    expect(runtime.config.canvas).toBeUndefined(); // AUTO retains WebGL / Canvas fallback.
    renderer.destroy();
  });
  it('reuses native emitters, keeps spawned particles in world space and removes obsolete effects', () => {
    const renderer = createPhaserProvider(options());
    const scene = runtime.config.scene[0];
    scene.create();
    const effect = {
      x: 100,
      y: 120,
      moving: false,
      areas: [{ x0: -10, x1: 10, y0: -50, y1: -40 }],
      style: {
        colors: ['#ffffff'],
        vx: 4,
        vy: -5,
        sway: 2,
        gravity: 0,
        life: [0.5, 1] as [number, number],
        size: [1, 3] as [number, number],
      },
    };
    renderer.beginFrame();
    renderer.particles('hat', effect);
    renderer.endFrame();
    const emitter = scene.add.particles.mock.results[0].value;
    expect(scene.add.particles.mock.calls[0].slice(0, 2)).toEqual([0, 0]);
    expect(emitter.config).toMatchObject({ maxParticles: 32, frequency: 100, lifespan: { min: 500, max: 1000 } });
    const point = { x: 0, y: 0 };
    emitter.config.emitZone.source.getRandomPoint(point);
    expect(point).toEqual({ x: 100, y: 75 });
    renderer.beginFrame();
    renderer.particles('hat', { ...effect, x: 200, moving: true });
    renderer.endFrame();
    expect(scene.add.particles).toHaveBeenCalledOnce();
    expect(emitter.setFrequency).toHaveBeenCalledWith(1000 / 24);
    emitter.config.emitZone.source.getRandomPoint(point);
    expect(point.x).toBe(200);
    renderer.beginFrame();
    renderer.endFrame();
    expect(emitter.destroy).toHaveBeenCalledOnce();
    renderer.destroy();
  });
  it('moves markers without restarting their tween and releases aura/marker tweens when hidden', () => {
    const renderer = createPhaserProvider(options());
    const scene = runtime.config.scene[0];
    scene.create();
    renderer.beginFrame();
    renderer.marker('target', 100, 200);
    renderer.aura('ring', 100, 200, 19, 5, 2, 'front');
    renderer.endFrame();
    expect(scene.tweens.add).toHaveBeenCalledTimes(2);
    const marker = scene.tweens.add.mock.results[0].value;
    marker.config.targets.offset = 1;
    renderer.beginFrame();
    renderer.marker('target', 150, 250);
    renderer.endFrame();
    expect(scene.tweens.add).toHaveBeenCalledTimes(2);
    expect(scene.add.graphics.mock.results[0].value.setPosition).toHaveBeenLastCalledWith(150, 237);
    expect(scene.tweens.add.mock.results[1].value.remove).toHaveBeenCalledOnce();
    renderer.beginFrame();
    renderer.endFrame();
    expect(marker.remove).toHaveBeenCalledOnce();
    renderer.destroy();
  });
});
