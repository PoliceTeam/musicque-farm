import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { createFarmProgress } from '@chibi-town/gameplay';
import { animalTimer, cropTimer } from '@chibi-town/gameplay/farm-progress-logic';
import { describe, expect, it } from 'vitest';

const hour = 3600000;
describe('farm world timers', () => {
  it('shows half growth and clamps ripe crops to a full bar', () => {
    const crop = { stage: 'growing' as const, cropId: 'tomato' as const, wateredAt: 0 };
    expect(cropTimer(crop, 2 * hour)).toMatchObject({ percent: 50, remainingMs: 2 * hour, ready: false });
    expect(cropTimer(crop, 5 * hour)).toMatchObject({ percent: 100, remainingMs: 0, ready: true });
    expect(cropTimer({ stage: 'dry', wateredAt: null }, hour)).toBeUndefined();
  });
  it('does not advance unfed animals and shows production after maturity', () => {
    const state = createFarmProgress();
    const animal = { species: 'hen' as const, boughtAt: 0, careAt: 0, ageMs: 12 * hour, productionMs: 0 };
    expect(animalTimer(state, 'poultry', animal, hour)).toMatchObject({ percent: 50, paused: true, phase: 'growth' });
    state.fedAt.poultry = 0;
    animal.ageMs = 24 * hour;
    expect(animalTimer(state, 'poultry', animal, hour)).toMatchObject({ remainingMs: 5 * hour, phase: 'production' });
    animal.productionMs = 6 * hour;
    expect(animalTimer(state, 'poultry', animal, hour)).toMatchObject({ percent: 100, ready: true, paused: false });
  });
  it('uses only food-covered elapsed time and leaves state untouched', () => {
    const state = createFarmProgress();
    state.fedAt.poultry = 0;
    const animal = { species: 'hen' as const, boughtAt: 0, careAt: 0, ageMs: 0, productionMs: 0 };
    const before = structuredClone(state);
    const result = animalTimer(state, 'poultry', animal, 100 * hour);
    expect(result.paused).toBe(true);
    expect(result.percent).toBeLessThan(100);
    expect(state).toEqual(before);
  });
  it('merges legacy home stock once and preserves the highest purchased warehouse level', async () => {
    const document = createLocalDocument();
    document.farm.inventory.tomato = 5;
    document.farm.homeInventory = { tomato: 7, milk: 9 };
    document.farm.chests.home = 3;
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => 0,
    });
    const first = await sdk.getInventory();
    const second = await sdk.getInventory();
    expect(first.farm.inventory).toMatchObject({ tomato: 12, milk: 9 });
    expect(first.farm.homeInventory).toEqual({});
    expect(first.farm.chests.main).toBe(3);
    expect(second.farm.inventory).toEqual(first.farm.inventory);
  });
});
