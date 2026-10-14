import { createFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmEggBaskets } from '@chibi-town/gameplay/farm-egg-logic';
import { collectFarmProducts } from '@chibi-town/gameplay/farm-product-logic';
import { describe, expect, it } from 'vitest';

const hour = 3600000;
describe('separate chicken and duck baskets', () => {
  it('hides absent species and shows an empty basket while birds grow', () => {
    const state = createFarmProgress();
    expect(farmEggBaskets(state, 0)).toEqual([]);
    state.poultry = [{ species: 'duck', boughtAt: 0, ageMs: 0, productionMs: 0 }];
    expect(farmEggBaskets(state, 0)).toEqual([{ species: 'duck', birds: 1, eggs: 0 }]);
    state.inventory.egg = 500;
    expect(farmEggBaskets(state, 0)[0].eggs).toBe(0);
  });
  it('counts ready eggs separately and empties baskets after collection', () => {
    const state = createFarmProgress();
    state.poultry = [
      { species: 'hen', boughtAt: 0, careAt: 0, ageMs: 24 * hour, productionMs: 6 * hour },
      { species: 'duck', boughtAt: 0, careAt: 0, ageMs: 48 * hour, productionMs: 6 * hour },
      { species: 'hen', boughtAt: 0, careAt: 0, ageMs: 0, productionMs: 0 },
    ];
    expect(farmEggBaskets(state, 0)).toEqual([
      { species: 'hen', birds: 2, eggs: 20 },
      { species: 'duck', birds: 1, eggs: 20 },
    ]);
    expect(collectFarmProducts(state, 'poultry', 0)).toBe(2);
    expect(state.inventory).toMatchObject({ egg: 20, duckEgg: 20 });
    expect(farmEggBaskets(state, 0).map((basket) => basket.eggs)).toEqual([0, 0]);
    expect(state.poultry).toHaveLength(3);
  });
});
