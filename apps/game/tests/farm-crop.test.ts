import { FARM_PLOT_LIMIT } from '@chibi-town/game-content/farm-land-config';
import {
  createFarmProgress,
  cropStage,
  FARM_GROW_MS,
  farmAction,
  farmLandPrice,
  parseFarmProgress,
} from '@chibi-town/gameplay/farm-crop-logic';
import { describe, expect, it } from 'vitest';

describe('farm crop and land commands', () => {
  it('requires care in order, grows offline, rewards once, and allows replanting', () => {
    const state = createFarmProgress();
    expect(farmAction(state, 0, 'sow', 1000)).toBe(false);
    expect(farmAction(state, 0, 'water', 1000)).toBe(false);
    expect(farmAction(state, 0, 'till', 1000)).toBe(true);
    expect(farmAction(state, 0, 'sow', 1000)).toBe(true);
    expect(farmAction(state, 0, 'water', 1000)).toBe(true);
    expect(farmAction(state, 0, 'water', 2000)).toBe(false);
    expect(farmAction(state, 0, 'harvest', 1000 + FARM_GROW_MS - 1)).toBe(false);
    const restored = parseFarmProgress(JSON.parse(JSON.stringify(state)));
    expect(cropStage(restored.plots[0], 1000 + FARM_GROW_MS)).toBe('ripe');
    expect(farmAction(restored, 0, 'harvest', 1000 + FARM_GROW_MS)).toBe(true);
    expect(restored.coins).toBe(29990);
    expect(restored.inventory.strawberry).toBe(60);
    expect(restored.harvested).toBe(1);
    expect(farmAction(restored, 0, 'harvest', 1000 + FARM_GROW_MS)).toBe(false);
    expect(farmAction(restored, 0, 'sow', 1000 + FARM_GROW_MS)).toBe(true);
  });
  it('only sells the next slot and caps land at the configured maximum without charging failed purchases', () => {
    const state = createFarmProgress();
    state.coins = 100_000_000;
    expect(farmAction(state, 7, 'buy', 0)).toBe(false);
    expect(farmAction(state, 6, 'till', 0)).toBe(false);
    for (let index = 6; index < FARM_PLOT_LIMIT; index++) {
      const before = state.coins,
        price = farmLandPrice(state.owned);
      expect(farmAction(state, index, 'buy', 0)).toBe(true);
      expect(state.coins).toBe(before - price);
    }
    expect(state.owned).toBe(FARM_PLOT_LIMIT);
    const coins = state.coins;
    expect(farmAction(state, FARM_PLOT_LIMIT, 'buy', 0)).toBe(false);
    expect(state.coins).toBe(coins);
  });
  it('does not spend unavailable money and recovers malformed saves', () => {
    const state = createFarmProgress();
    state.coins = 0;
    farmAction(state, 0, 'till', 0);
    expect(farmAction(state, 0, 'sow', 0)).toBe(false);
    expect(farmAction(state, 6, 'buy', 0)).toBe(false);
    expect(parseFarmProgress({ ...state, owned: FARM_PLOT_LIMIT + 1 })).toEqual(createFarmProgress());
    expect(parseFarmProgress({ ...state, plots: [] })).toEqual(createFarmProgress());
    state.plots[0] = { stage: 'growing', wateredAt: null };
    expect(parseFarmProgress(state)).toEqual(createFarmProgress());
  });
});

it('adds twelve empty plots to an old 48-plot save without changing money, inventory or existing crops', () => {
  const state = createFarmProgress();
  state.owned = 7;
  state.coins = 10525;
  state.inventory.strawberry = 9;
  state.plots[0] = { stage: 'growing', wateredAt: 1000 };
  const old = { ...state, plots: state.plots.slice(0, 48) };
  const migrated = parseFarmProgress(JSON.parse(JSON.stringify(old)));
  expect(migrated.owned).toBe(7);
  expect(migrated.coins).toBe(10525);
  expect(migrated.inventory).toEqual(state.inventory);
  expect(migrated.plots.slice(0, 48)).toEqual(old.plots);
  expect(migrated.plots).toHaveLength(60);
  expect(migrated.plots.slice(48).every((p) => p.stage === 'dry' && p.wateredAt === null)).toBe(true);
});
