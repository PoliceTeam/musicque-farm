import { createFarmProgress, FARM_GROW_MS, farmAction, parseFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { feedFarmUnit } from '@chibi-town/gameplay/farm-feeding-logic';
import { buyFarmSeeds, sellFarmProduce } from '@chibi-town/gameplay/farm-inventory-logic';
import { buyFarmAnimal, expandFarmUnit } from '@chibi-town/gameplay/farm-unit-logic';
import { describe, expect, it } from 'vitest';

describe('warehouse and free range animals', () => {
  it('harvests into persistent stock without selling, sells only on request and never twice', () => {
    const p = createFarmProgress();
    expect(buyFarmSeeds(p, 10)).toBe(true);
    expect(p.coins).toBe(29900);
    for (let i = 0; i < 2; i++) {
      farmAction(p, i, 'till', 0);
      farmAction(p, i, 'sow', 0);
      farmAction(p, i, 'water', 0);
      expect(farmAction(p, i, 'harvest', FARM_GROW_MS)).toBe(true);
    }
    expect(p.coins).toBe(29900);
    expect(p.inventory).toEqual({ strawberry: 120, seed: 8 });
    expect(farmAction(p, 0, 'harvest', FARM_GROW_MS)).toBe(false);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(p)));
    expect(loaded.inventory).toEqual(p.inventory);
    expect(sellFarmProduce(loaded, 121)).toBe(false);
    expect(sellFarmProduce(loaded, 2)).toBe(true);
    expect(loaded.coins).toBe(29902);
    expect(loaded.inventory.strawberry).toBe(118);
    expect(sellFarmProduce(loaded, 118)).toBe(true);
    expect(sellFarmProduce(loaded, 1)).toBe(false);
    for (const n of [-1, 0, 1.5, NaN, Infinity]) {
      expect(sellFarmProduce(loaded, n)).toBe(false);
      expect(buyFarmSeeds(loaded, n)).toBe(false);
    }
  });
  it('splits existing poultry out of pens without losing age, money or bought places', () => {
    const p = createFarmProgress();
    p.animals = [
      { species: 'cow', boughtAt: 100 },
      { species: 'hen', boughtAt: 200 },
      { species: 'duck', boughtAt: 300 },
    ];
    const { poultry: _, inventory: _i, ...v14 } = p;
    const migrated = parseFarmProgress({
      ...v14,
      capacity: { livestock: 24, pond: 20 },
      fedAt: { livestock: 1000, pond: null },
    });
    expect(migrated.animals).toMatchObject([{ species: 'cow', boughtAt: 100 }]);
    expect(migrated.poultry).toMatchObject(p.animals.slice(1));
    expect(migrated.coins).toBe(30000);
    expect(migrated.capacity.livestock).toBe(24);
    expect(migrated.fedAt.poultry).toBe(1000);
    expect(parseFarmProgress(migrated)).toEqual(migrated);
    expect(parseFarmProgress({ ...p, animals: [null] })).toEqual(createFarmProgress());
    expect(parseFarmProgress({ ...p, inventory: { strawberry: -1, seed: 0 } })).toEqual(createFarmProgress());
    expect(
      parseFarmProgress({
        ...v14,
        animals: Array.from({ length: 24 }, () => ({ species: 'hen', boughtAt: 100 })),
        capacity: { livestock: 24, pond: 5 },
      }).poultry,
    ).toHaveLength(24);
  });
  it('separates species, places and feeding for free animals and preserves independent fullness on reload', () => {
    const p = createFarmProgress();
    expect(buyFarmAnimal(p, 'livestock', 'hen', 0)).toBe(false);
    expect(buyFarmAnimal(p, 'poultry', 'pig', 0)).toBe(false);
    expect(buyFarmAnimal(p, 'poultry', 'hen', 0)).toBe(true);
    expect(buyFarmAnimal(p, 'livestock', 'pig', 0)).toBe(true);
    expect(feedFarmUnit(p, 'livestock', 1000)).toBe(true);
    expect(parseFarmProgress(p).fedAt.poultry).toBeNull();
    expect(feedFarmUnit(p, 'poultry', 2000)).toBe(true);
    expect(p.fedAt).toEqual({ livestock: 1000, poultry: 2000, pond: null });
    for (let i = 6; i < 24; i++) expect(expandFarmUnit(p, 'poultry')).toBe(true);
    expect(p.units.livestock).toBe(0);
    expect(p.capacity.livestock).toBe(10);
    expect(expandFarmUnit(p, 'poultry')).toBe(false);
  });
});
