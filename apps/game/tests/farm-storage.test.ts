import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { FARM_RECIPES } from '@chibi-town/game-content';
import { FARM_PRODUCTS } from '@chibi-town/game-content/farm-balance';
import {
  butcherFarmAnimal,
  canStoreFarmGoods,
  chestSlots,
  collectFarmProducts,
  collectFarmRecipe,
  createFarmProgress,
  type FarmProduct,
  farmAction,
  occupiedChestSlots,
  parseFarmProgress,
  sellFarmItem,
  transferFarmGoods,
  upgradeFarmChest,
} from '@chibi-town/gameplay';
import { describe, expect, it } from 'vitest';

const ids = Object.keys(FARM_PRODUCTS) as FarmProduct[];

function filled(exclude: FarmProduct[] = []) {
  const state = createFarmProgress();
  for (const id of ids.filter((id) => !exclude.includes(id)).slice(0, 12)) state.inventory[id] = 10;
  return state;
}

describe('six-level stackable chests', () => {
  it.each(['main', 'home'] as const)(
    '%s upgrades one level at a time, with exact currency, and rejects MAX',
    (chest) => {
      const state = createFarmProgress();
      state.coins = 1000000;
      state.gems = 1000;
      const coinCosts = chest === 'main' ? [50000, 100000, 0, 0, 0] : [100000, 200000, 500000, 0, 0];
      const gemCosts = chest === 'main' ? [0, 0, 50, 100, 150] : [0, 0, 0, 200, 500];
      expect(chestSlots(state, chest)).toBe(12);
      for (let i = 0; i < 5; i++) {
        const { coins, gems } = state;
        expect(upgradeFarmChest(state, chest)).toBe(true);
        expect(state.coins).toBe(coins - coinCosts[i]);
        expect(state.gems).toBe(gems - gemCosts[i]);
        expect(chestSlots(state, chest)).toBe([18, 24, 30, 36, 48][i]);
      }
      const before = structuredClone(state);
      expect(upgradeFarmChest(state, chest)).toBe(false);
      expect(state).toEqual(before);
    },
  );
  it('rejects insufficient Gem payment without spending coins or changing the level', () => {
    const state = createFarmProgress();
    state.chests.main = 3;
    const before = structuredClone(state);
    expect(upgradeFarmChest(state, 'main')).toBe(false);
    expect(state).toEqual(before);
  });
  it('stacks unlimited safe quantities of an existing type, frees a slot on sale, and ignores seeds', () => {
    const state = filled();
    state.inventory.seed = 100;
    state.seeds = { tomato: 10, aloe: 100 };
    expect(occupiedChestSlots(state, 'main')).toBe(12);
    expect(canStoreFarmGoods(state, { tomato: 100000 })).toBe(true);
    expect(canStoreFarmGoods(state, { chili: 1 })).toBe(false);
    expect(sellFarmItem(state, 'tomato', 10)).toBe(true);
    expect(canStoreFarmGoods(state, { chili: 1 })).toBe(true);
    state.inventory.carrot = Number.MAX_SAFE_INTEGER;
    expect(canStoreFarmGoods(state, { carrot: 1 })).toBe(false);
  });
  it('full storage preserves the ripe crop, finished dish and animal until there is room', () => {
    const state = filled(['chili', 'eggCake', 'beef', 'egg']);
    state.plots[0] = { stage: 'ripe', wateredAt: 100, cropId: 'chili' };
    const plot = structuredClone(state.plots[0]);
    expect(farmAction(state, 0, 'harvest', 100)).toBe(false);
    expect(state.plots[0]).toEqual(plot);
    state.kitchen = [{ id: 'job', recipeId: 'eggCake', startedAt: 100, readyAt: 100 + FARM_RECIPES.eggCake.cookMs }];
    expect(collectFarmRecipe(state, 'job', 100 + FARM_RECIPES.eggCake.cookMs)).toBe(false);
    expect(state.kitchen).toHaveLength(1);
    state.animals = [{ id: 'cow', species: 'cow', boughtAt: 100, careAt: 100, ageMs: 259200000, productionMs: 0 }];
    expect(butcherFarmAnimal(state, 'livestock', 0, 100)).toBe(false);
    expect(state.animals).toHaveLength(1);
    state.poultry = [
      { id: 'hen', species: 'hen', boughtAt: 100, careAt: 100, ageMs: 86400000, productionMs: 21600000 },
    ];
    expect(collectFarmProducts(state, 'poultry', 100)).toBe(0);
    expect(state.poultry[0].productionMs).toBe(21600000);
    state.chests.main = 2;
    expect(farmAction(state, 0, 'harvest', 100)).toBe(true);
    expect(collectFarmRecipe(state, 'job', 100 + FARM_RECIPES.eggCake.cookMs)).toBe(true);
  });
  it('moves a whole stack atomically, sells from the chosen chest and refuses a full destination', () => {
    const state = filled();
    for (const id of ids.filter((id) => id !== 'tomato').slice(0, 12)) state.homeInventory[id] = 1;
    expect(transferFarmGoods(state, 'main', 'tomato', 10)).toBe(false);
    expect(state.inventory.tomato).toBe(10);
    state.chests.home = 2;
    expect(transferFarmGoods(state, 'main', 'tomato', 10)).toBe(true);
    expect(state.inventory.tomato).toBe(0);
    expect(state.homeInventory.tomato).toBe(10);
    expect(sellFarmItem(state, 'tomato', 1, 'home')).toBe(true);
    expect(state.homeInventory.tomato).toBe(9);
    expect(state.coins).toBe(30001);
    expect(transferFarmGoods(state, 'home', 'tomato', 9)).toBe(true);
    expect(state.inventory.tomato).toBe(9);
  });
  it('preserves overfull legacy saves and allows stacking but refuses new types', () => {
    const state = createFarmProgress();
    for (const id of ids.slice(0, 20)) state.inventory[id] = 10;
    const { chests: _c, homeInventory: _h, ...legacy } = state;
    const migrated = parseFarmProgress(legacy);
    expect(migrated.inventory).toEqual(state.inventory);
    expect(migrated.chests).toEqual({ main: 1, home: 1 });
    expect(canStoreFarmGoods(migrated, { tomato: 10 })).toBe(true);
    expect(canStoreFarmGoods(migrated, { pizza: 1 })).toBe(false);
    expect(parseFarmProgress(migrated)).toEqual(migrated);
  });
  it('shares chest levels and stored items across maps and retries a purchase without double spending', async () => {
    const document = createLocalDocument();
    document.farm.coins = 200000;
    document.farm.inventory.tomato = 75;
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => 100,
    });
    const second = await sdk.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'second' });
    const upgrade = {
      type: 'upgrade-chest',
      chest: 'home',
      requestId: 'upgrade',
      mapInstanceId: second.mapInstanceId,
    } as const;
    await sdk.execute(upgrade);
    await sdk.execute(upgrade);
    await sdk.execute({
      type: 'transfer-goods',
      from: 'main',
      product: 'tomato',
      count: 75,
      requestId: 'transfer',
      mapInstanceId: second.mapInstanceId,
    });
    const home = await sdk.getInventory();
    expect(home.farm.coins).toBe(100000);
    expect(home.farm.chests.home).toBe(2);
    expect(home.farm.inventory.tomato).toBe(0);
    expect(home.farm.homeInventory.tomato).toBe(75);
  });
  it('the SDK rejects full-warehouse harvests and leaves the saved crop and receipt untouched', async () => {
    const document = createLocalDocument();
    document.farm = filled(['chili']);
    document.farm.plots[0] = { stage: 'ripe', wateredAt: 100, cropId: 'chili' };
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => 100,
    });
    const command = { type: 'plot', index: 0, action: 'harvest', requestId: 'harvest', mapInstanceId: 'home' } as const;
    await expect(sdk.execute(command)).rejects.toMatchObject({ code: 'INVENTORY_FULL' });
    expect((await sdk.getInventory()).farm.plots[0].stage).toBe('ripe');
    await sdk.execute({
      type: 'transfer-goods',
      from: 'main',
      product: 'tomato',
      count: 10,
      requestId: 'room',
      mapInstanceId: 'home',
    });
    expect((await sdk.execute(command)).farm.inventory.chili).toBe(45);
  });
});
