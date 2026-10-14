import { createFarmProgress } from '@chibi-town/gameplay';
import { afterEach, expect, it, vi } from 'vitest';
import { createFarmAnimalMotion } from '@/features/farm/rendering/farm-animal-view';
import { createFarmPondMotion } from '@/features/farm/rendering/farm-pond-view';

afterEach(() => vi.unstubAllGlobals());
it('reuses animation canvases after buying/selling and reads replacement snapshot ages', () => {
  const context = new Proxy({}, { get: () => () => undefined });
  const makeCanvas = vi.fn(() => ({
    width: 100,
    height: 100,

    getContext: () => context,
  }));
  vi.stubGlobal('document', { createElement: makeCanvas });
  const source = { width: 100, height: 100 } as HTMLCanvasElement;
  const asset = vi.fn(() => source);
  const state = createFarmProgress();
  state.animals = [{ species: 'pig', boughtAt: 0, ageMs: 0 }];
  state.fish = [{ species: 'fish', boughtAt: 0, ageMs: 0 }];
  const area = { x0: 0, x1: 300, y0: 0, y1: 400 };
  createFarmAnimalMotion(asset, area, state);
  createFarmPondMotion(asset, area, 0, state);
  const built = makeCanvas.mock.calls.length;
  state.animals.push({ species: 'dog', boughtAt: 0, ageMs: 0 });
  const motion = createFarmAnimalMotion(asset, area, state);
  state.fish = [{ species: 'turtle', boughtAt: 0, ageMs: 0 }];
  createFarmPondMotion(asset, area, 0, state);
  expect(makeCanvas.mock.calls.length).toBe(built);
  state.animals = state.animals.map((animal) => ({ ...animal, ageMs: 864000000 }));
  motion.sync(0, 100);
  expect(motion.surfaces[1].key).toContain('dog-3-');
  state.animals.shift();
  const sold = createFarmAnimalMotion(asset, area, state);
  sold.sync(0, 100);
  expect(sold.surfaces[0].key).toContain('dog-3-');
  expect(makeCanvas.mock.calls.length).toBe(built);
});

it('keeps scenery and crop surfaces when livestock is bought, sold or collected', async () => {
  const { farmStyleScenery } = await import('@/features/farm/rendering/farm-style-view');
  const context: object = new Proxy({}, { get: () => () => context });
  const makeCanvas = vi.fn(() => ({
    width: 100,
    height: 100,

    getContext: () => context,
  }));
  vi.stubGlobal('document', { createElement: makeCanvas });
  vi.stubGlobal(
    'Path2D',
    class {
      moveTo() {}

      lineTo() {}

      closePath() {}
    },
  );
  vi.stubGlobal(
    'Image',
    class {
      width = 100;
      height = 100;

      async decode() {}
    },
  );
  const state = createFarmProgress();
  state.animals = [{ id: 'pig-1', species: 'pig', boughtAt: 0, ageMs: 0 }];
  const scenery = await farmStyleScenery(state, state.units);
  const permanent = scenery.surfaces.filter((s) => !s.key.startsWith('animal-') && !s.key.includes('motion-v9'));
  const built = makeCanvas.mock.calls.length;
  for (const animals of [
    [...state.animals, { id: 'dog-1', species: 'dog' as const, boughtAt: 0, ageMs: 0 }],
    [{ id: 'dog-1', species: 'dog' as const, boughtAt: 0, ageMs: 0 }],
    [],
  ]) {
    state.animals = animals;
    scenery.sync(0);
    expect(scenery.animalAnchors()).toHaveLength(animals.length);
    expect(makeCanvas.mock.calls.length).toBe(built);
    for (const surface of permanent) expect(scenery.surfaces).toContain(surface);
  }
});
