import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { createFarmProgress, parseFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { feedFarmUnit } from '@chibi-town/gameplay/farm-feeding-logic';
import { advanceFarmAnimals } from '@chibi-town/gameplay/farm-product-logic';
import {
  buyFarmAnimal,
  expandFarmUnit,
  farmRecordStage,
  farmUnitLevel,
  farmUnitPrice,
} from '@chibi-town/gameplay/farm-unit-logic';
import { describe, expect, it } from 'vitest';
import { farmFeatureAt, farmFeaturesFor, farmUnitArea } from '@/features/farm/_utils/farm-map-data';
import { farmFishGroup } from '@/features/farm/_utils/farm-pond-logic';

describe('individual capacity and animal purchases', () => {
  it('starts with empty purchasable places; each upgrade adds exactly one and only milestones expand the area', () => {
    for (const unit of ['livestock', 'pond'] as const) {
      const p = createFarmProgress();
      p.gems = 1000;
      p.coins = 100_000_000;
      expect(p.animals).toHaveLength(0);
      expect(p.fish).toHaveLength(0);
      const max = unit === 'livestock' ? 20 : 10;
      for (let n = p.capacity[unit]; n < max; n++) {
        const before = p.coins,
          old = farmUnitArea(unit, p.units[unit]),
          price = farmUnitPrice(unit, n);
        expect(expandFarmUnit(p, unit)).toBe(true);
        expect(p.capacity[unit]).toBe(n + 1);
        expect(p.coins).toBe(before - price);
        expect(p.units[unit]).toBe(farmUnitLevel(unit, n + 1));
        const changed = n + 1 === (unit === 'livestock' ? 15 : 5) || n + 1 === (unit === 'livestock' ? 20 : 8);
        expect(JSON.stringify(farmUnitArea(unit, p.units[unit])) !== JSON.stringify(old)).toBe(changed);
      }
      const balance = p.coins;
      expect(expandFarmUnit(p, unit)).toBe(false);
      expect(p.coins).toBe(balance);
      expect(p.capacity[unit === 'pond' ? 'livestock' : 'pond']).toBe(unit === 'pond' ? 10 : 2);
    }
  });
  it('buys one young animal at a time, caps purchases, rejects wrong species, and restores independent ages', () => {
    const p = createFarmProgress();
    p.gems = 1000;
    p.coins = 100_000_000;
    expect(feedFarmUnit(p, 'livestock', 1000)).toBe(false);
    expect(buyFarmAnimal(p, 'livestock', 'fish', 1000)).toBe(false);
    expect(buyFarmAnimal(p, 'pond', 'cow', 1000)).toBe(false);
    expect(buyFarmAnimal(p, 'pond', 'fish', NaN)).toBe(false);
    for (let i = 0; i < 6; i++) expect(buyFarmAnimal(p, 'livestock', 'cow', i * 1000)).toBe(true);
    const balance = p.coins;
    expect(buyFarmAnimal(p, 'livestock', 'hen', 10000)).toBe(false);
    expect(p.coins).toBe(balance);
    expect(expandFarmUnit(p, 'livestock')).toBe(true);
    for (const now of Array.from({ length: 8 }, (_, i) => i * 9 * 3600000))
      expect(feedFarmUnit(p, 'livestock', now)).toBe(true);
    advanceFarmAnimals(p, FARM_ANIMAL_CATALOG.cow.maturityMs);
    expect(buyFarmAnimal(p, 'livestock', 'pig', FARM_ANIMAL_CATALOG.cow.maturityMs)).toBe(true);
    expect(farmRecordStage(p.animals[0], 1000000)).toBe(2);
    expect(farmRecordStage(p.animals[6], 1000000)).toBe(0);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(p)));
    expect(loaded).toEqual(p);
    expect(loaded.animals).not.toBe(p.animals);
    p.coins = 0;
    expect(expandFarmUnit(p, 'pond')).toBe(false);
    expect(buyFarmAnimal(p, 'pond', 'fish', 0)).toBe(false);
  });
  it('keeps historical herds, fish, money and crops when migrating old saves', () => {
    const p = createFarmProgress();
    p.gems = 1000;
    p.coins = 100_000_000;
    p.owned = 7;
    p.coins = 10525;
    p.plots[0].stage = 'seeded';
    const { capacity: _, animals: _a, fish: _f, ...old } = p;
    for (const level of [0, 1, 2] as const) {
      const loaded = parseFarmProgress({ ...old, units: { livestock: level, pond: level } });
      expect(loaded.animals).toHaveLength(9);
      expect(loaded.poultry).toHaveLength(6);
      expect(loaded.fish).toHaveLength(5 + level * 2);
      expect(loaded.coins).toBe(10525);
      expect(loaded.owned).toBe(7);
      expect(loaded.plots[0].stage).toBe('seeded');
      expect(loaded.capacity.livestock).toBe(level === 2 ? 24 : 15);
      expect(loaded.capacity.pond).toBe([5, 10, 20][level]);
      expect(parseFarmProgress(loaded)).toEqual(loaded);
    }
    expect(parseFarmProgress({ ...p, capacity: { livestock: 25, pond: 5 } })).toEqual(createFarmProgress());
    expect(parseFarmProgress({ ...p, animals: [{ species: 'fish', boughtAt: 0 }] })).toEqual(createFarmProgress());
  });
});

it('spreads fish at maximum density for each footprint, including feeding, within shore bounds', () => {
  for (const [level, count] of [
    [0, 9],
    [1, 15],
    [2, 20],
  ] as const) {
    const a = farmUnitArea('pond', level),
      w = a.x1 - a.x0,
      h = a.y1 - a.y0;
    for (let t = 0; t < 180000; t += 1900)
      for (const feeding of [0, 1]) {
        const points = farmFishGroup(w, h, count, t, feeding, 390 - a.y0);
        for (const p of points) {
          expect(p.x).toBeGreaterThanOrEqual(40);
          expect(p.x).toBeLessThanOrEqual(w - 40);
          expect(p.y).toBeGreaterThanOrEqual(41);
          expect(p.y).toBeLessThanOrEqual(h - 41);
        }
        for (let i = 0; i < count; i++)
          for (let j = i + 1; j < count; j++)
            expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(25);
      }
  }
});

it('fills each maximum capacity without accepting a twenty-first animal or eleventh fish', () => {
  const p = createFarmProgress();
  p.gems = 1000;
  p.coins = 100_000_000;
  for (const unit of ['livestock', 'pond'] as const) {
    const max = unit === 'livestock' ? 20 : 10;
    while (p.capacity[unit] < max) expect(expandFarmUnit(p, unit)).toBe(true);
    for (let i = 0; i < max; i++) expect(buyFarmAnimal(p, unit, unit === 'pond' ? 'fish' : 'cow', 1000)).toBe(true);
    const balance = p.coins;
    expect(buyFarmAnimal(p, unit, unit === 'pond' ? 'fish' : 'cow', 1000)).toBe(false);
    expect(p.coins).toBe(balance);
  }
  expect(parseFarmProgress(p)).toEqual(p);
});

it('keeps the capacity buy sign selectable at the largest footprint until all places are unlocked', () => {
  const features = farmFeaturesFor({ livestock: 2, pond: 2 }),
    a = farmUnitArea('livestock', 2);
  expect(farmFeatureAt(a.x1 + 23, 417, features, { livestock: 18 })?.id).toBe('livestock');
  expect(farmFeatureAt(a.x1 + 23, 417, features, { livestock: 24 })).toBeUndefined();
});
