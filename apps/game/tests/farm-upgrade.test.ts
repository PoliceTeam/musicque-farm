import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { chestUpgradePrice, landUpgradePrice, unitUpgradePrice } from '@chibi-town/game-content/farm-upgrade-catalog';
import { createFarmProgress, expandFarmUnit, parseFarmProgress } from '@chibi-town/gameplay';
import { describe, expect, it } from 'vitest';

describe('requested upgrade prices', () => {
  it.each([
    [7, 10800],
    [8, 14700],
    [9, 19200],
    [10, 24300],
    [11, 30000],
    [12, 36300],
    [13, 43200],
    [14, 50700],
    [15, 58800],
    [16, 67500],
    [17, 76800],
    [18, 86700],
    [19, 97200],
    [20, 108300],
    [24, 158700],
    [30, 252300],
    [40, 456300],
    [48, 662700],
  ])('plot %i costs %i, matching the table rather than the inconsistent expression', (next, price) => {
    expect(landUpgradePrice(next - 1)).toBe(price);
  });
  it('extends the existing 60-plot map and rejects purchases beyond it', () => {
    expect(landUpgradePrice(59)).toBe(1044300);
    for (const value of [60, 61, 5, NaN, Infinity, 6.5]) expect(landUpgradePrice(value)).toBe(0);
  });
  it.each([
    ['livestock', 10, [20000, 80000, 180000, 320000, 500000, 720000, 980000, 1280000, 1620000, 2000000], 7700000],
    ['pond', 2, [50000, 200000, 450000, 800000, 1250000, 1800000, 2450000, 3200000], 10200000],
  ] as const)('%s buys exactly one place at each price and stops at MAX', (unit, start, prices, total) => {
    const state = createFarmProgress();
    state.coins = total;
    expect(state.capacity[unit]).toBe(start);
    for (const price of prices) {
      const before = state.capacity[unit];
      expect(unitUpgradePrice(unit, before)).toBe(price);
      expect(expandFarmUnit(state, unit)).toBe(true);
      expect(state.capacity[unit]).toBe(before + 1);
    }
    expect(state.coins).toBe(0);
    expect(expandFarmUnit(state, unit)).toBe(false);
    expect(unitUpgradePrice(unit, state.capacity[unit])).toBe(0);
    expect(parseFarmProgress(state)).toEqual(state);
  });
  it('keeps every chest price and its correct currency, with level 6 as MAX', () => {
    const main = [50000, 100000, 50, 100, 150];
    const home = [100000, 200000, 500000, 200, 500];
    for (let level = 1; level < 6; level++) {
      expect(chestUpgradePrice('main', level)).toEqual({
        amount: main[level - 1],
        currency: level < 3 ? 'coins' : 'gems',
      });
      expect(chestUpgradePrice('home', level)).toEqual({
        amount: home[level - 1],
        currency: level < 4 ? 'coins' : 'gems',
      });
    }
    for (const level of [0, 6, 7, NaN, 1.5]) expect(chestUpgradePrice('main', level)).toBeNull();
  });
  it('migrates a six-place pen to ten without charging or removing animals, and retains purchased legacy maximums', () => {
    const old = createFarmProgress();
    old.capacity.livestock = 6;
    old.capacity.pond = 5;
    old.animals = [{ species: 'pig', boughtAt: 100 }];
    const upgraded = parseFarmProgress(old);
    expect(upgraded.capacity).toEqual({ livestock: 10, poultry: 6, pond: 5 });
    expect(upgraded.coins).toBe(old.coins);
    expect(upgraded.animals).toMatchObject(old.animals);
    old.capacity = { livestock: 24, poultry: 24, pond: 20 };
    const retained = parseFarmProgress(old);
    expect(retained.capacity).toEqual(old.capacity);
    expect(expandFarmUnit(retained, 'livestock')).toBe(false);
    expect(expandFarmUnit(retained, 'pond')).toBe(false);
    expect(retained.coins).toBe(old.coins);
  });
  it('insufficient money rolls back; repeated SDK upgrade requests cannot spend twice', async () => {
    const document = createLocalDocument();
    document.farm.coins = 49999;
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => 100,
    });
    await expect(
      sdk.execute({ requestId: 'pond', mapInstanceId: 'home', type: 'expand', unit: 'pond' }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await sdk.getInventory()).farm.coins).toBe(49999);
    expect((await sdk.getInventory()).farm.capacity.pond).toBe(2);
    const command = { requestId: 'pen', mapInstanceId: 'home', type: 'expand', unit: 'livestock' } as const;
    await sdk.execute(command);
    await sdk.execute(command);
    const after = await sdk.getInventory();
    expect(after.farm.coins).toBe(29999);
    expect(after.farm.capacity.livestock).toBe(11);
  });
});

it('refreshes MAX markers without a footprint change, and refreshes a replaced animal at the same count', async () => {
  const { farmLayoutSignature } = await import('@chibi-town/gameplay/farm-layout-logic');
  const state = createFarmProgress();
  state.capacity.pond = 9;
  state.units.pond = 2;
  state.coins = 3200000;
  const before = farmLayoutSignature(state);
  expect(expandFarmUnit(state, 'pond')).toBe(true);
  expect(state.units.pond).toBe(2);
  expect(farmLayoutSignature(state)).not.toBe(before);
  state.animals = [{ id: 'first', species: 'pig', boughtAt: 100 }];
  const herd = farmLayoutSignature(state);
  state.animals = [{ id: 'second', species: 'buffalo', boughtAt: 100 }];
  expect(farmLayoutSignature(state)).not.toBe(herd);
});
