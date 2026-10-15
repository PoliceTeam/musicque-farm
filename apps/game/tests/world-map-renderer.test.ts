import { createWorldMapView, type WorldMapViewOptions } from '@chibi-town/renderer-phaser/world-map-view';
import { beforeEach, expect, it, vi } from 'vitest';
import { WORLD_DECOR } from '@/features/world-map/_utils/world-map-data';

type ImageFixture = ReturnType<typeof imageFixture>;
type SceneFixture = {
  add: { image: ReturnType<typeof vi.fn> };
  cow?: ImageFixture;
  chickens: unknown[];
  waterG: Record<string, ReturnType<typeof vi.fn>>;
  fish: unknown;
  fishNext: number;
  addLandmarks(): void;
  updateFarm(sec: number, dt: number, tint: number): void;
  drawFountains(sec: number, light: unknown): void;
  updateFish(dt: number, tint: number): void;
};
const runtime = vi.hoisted(() => ({ scene: undefined as unknown as SceneFixture, vector: vi.fn(), destroy: vi.fn() }));

function imageFixture() {
  const image = {
    setTexture: vi.fn(),
    setPosition: vi.fn(),
    setDepth: vi.fn(),
    setTint: vi.fn(),
    setAngle: vi.fn(),
    setFlipX: vi.fn(),
    setOrigin: vi.fn(),
    setStrokeStyle: vi.fn(),
  };
  for (const method of Object.values(image)) method.mockReturnValue(image);
  return image;
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      add = { image: vi.fn(() => imageFixture()), ellipse: vi.fn(() => imageFixture()) };
    },
    Game: class {
      destroy = runtime.destroy;

      constructor(options: { scene: SceneFixture[] }) {
        runtime.scene = options.scene[0];
      }
    },
    AUTO: 0,
    Scale: { RESIZE: 1 },
    Math: {
      Between: () => 0,

      Clamp: (value: number, low: number, high: number) => Math.max(low, Math.min(high, value)),

      Vector2: class {
        constructor(x: number, y: number) {
          runtime.vector(x, y);
        }
      },
    },
  },
}));

beforeEach(() => vi.clearAllMocks());

function mount(fishSpots = WORLD_DECOR.fishSpots) {
  return createWorldMapView({
    parent: {} as HTMLElement,
    size: { width: 2000, height: 1000 },
    images: {} as WorldMapViewOptions['images'],
    sprites: { cow: { url: '/cow.png', x: 10, y: 20, w: 38, h: 26 } },
    life: [],
    zones: [],
    decor: { ...WORLD_DECOR, fishSpots },

    canWalk: () => true,

    walkRoute: () => ({ at: [0, 0], moving: false, facingLeft: false }),

    lighting: () => ({ day: 1, night: 0, dawn: 0, evening: 0 }),

    zoneAt: () => undefined,
  });
}

it('creates the existing cow artwork and animates its foot anchor', () => {
  const view = mount();
  const scene = runtime.scene;
  scene.addLandmarks();
  expect(scene.add.image).toHaveBeenCalledWith(29, 33, 'sp-cow');
  expect(scene.cow).toBeDefined();
  scene.updateFarm(6, 0.016, 0xffffff);
  expect(scene.cow?.setPosition).toHaveBeenCalled();
  view.destroy();
  expect(runtime.destroy).toHaveBeenCalledOnce();
});

it('only changes animated textures when the frame changes', () => {
  const view = mount();
  const scene = runtime.scene;
  const sprite = imageFixture();
  scene.chickens = [{ sprite, x: 100, y: 100, tx: 105, ty: 100, wait: 100 }];
  scene.updateFarm(0.1, 0.01, 0xffffff);
  scene.updateFarm(0.11, 0.01, 0xffffff);
  expect(sprite.setTexture).toHaveBeenCalledOnce();
  view.destroy();
});

it('draws the same fountain arcs directly without allocating vectors each frame', () => {
  const view = mount();
  const scene = runtime.scene;
  const graphics = Object.fromEntries(
    ['clear', 'lineStyle', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'strokePoints'].map((name) => [
      name,
      vi.fn(),
    ]),
  );
  scene.waterG = graphics;
  scene.drawFountains(1, { night: 0 });
  expect(graphics.beginPath).toHaveBeenCalledTimes(WORLD_DECOR.fountains.length * 6);
  expect(graphics.lineTo).toHaveBeenCalledTimes(WORLD_DECOR.fountains.length * 6 * 16);
  expect(runtime.vector).not.toHaveBeenCalled();
  view.destroy();
});

it('ignores fish animation when no spots are supplied', () => {
  const view = mount([]);
  const scene = runtime.scene;
  const explode = vi.fn();
  scene.fish = { sprite: imageFixture(), splash: { explode } };
  scene.fishNext = 0;
  expect(() => scene.updateFish(1, 0xffffff)).not.toThrow();
  expect(explode).not.toHaveBeenCalled();
  view.destroy();
});
