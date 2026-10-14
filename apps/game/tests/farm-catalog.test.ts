import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import type { Command } from '@chibi-town/contracts';
import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { CROP_IDS, FARM_CROPS, HOUR_MS } from '@chibi-town/game-content/farm-catalog';
import { FARM_RECIPES } from '@chibi-town/game-content/farm-recipes';
import {
  butcherFarmAnimal,
  buyFarmAnimal,
  buyFarmSeeds,
  collectFarmProducts,
  collectFarmRecipe,
  createFarmProgress,
  farmAction,
  parseFarmProgress,
  sellFarmAnimal,
  sellFarmItem,
  startFarmRecipe,
} from '@chibi-town/gameplay';
import { describe, expect, it } from 'vitest';

const map = { regionId: 'farm', mapId: 'farm-home', instanceId: 'home' };
describe('farm catalogue gameplay', () => {
  it.each(CROP_IDS)('%s consumes a seed, rejects early harvest and stores the exact yield without selling', (id) => {
    const state = createFarmProgress();
    state.gems = 20;
    const crop = FARM_CROPS[id];
    const wallet = state[crop.currency];
    expect(buyFarmSeeds(state, 2, id)).toBe(true);
    expect(state[crop.currency]).toBe(wallet - 2 * crop.seedPrice);
    expect(farmAction(state, 0, 'till', 100)).toBe(true);
    expect(farmAction(state, 0, 'sow', 100, id)).toBe(true);
    expect(id === 'strawberry' ? state.inventory.seed : state.seeds[id]).toBe(1);
    expect(state[crop.currency]).toBe(wallet - 2 * crop.seedPrice);
    expect(farmAction(state, 0, 'water', 100)).toBe(true);
    expect(farmAction(state, 0, 'harvest', 99 + crop.growMs)).toBe(false);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(state)));
    expect(farmAction(loaded, 0, 'harvest', 100 + crop.growMs)).toBe(true);
    expect(loaded.inventory[id]).toBe(crop.yield);
    expect(loaded[crop.currency]).toBe(wallet - 2 * crop.seedPrice);
    expect(farmAction(loaded, 0, 'harvest', 100 + crop.growMs)).toBe(false);
    expect(sellFarmItem(loaded, id, crop.yield)).toBe(crop.sellPrice !== null);
    if (crop.sellPrice === null) expect(loaded.inventory[id]).toBe(crop.yield);
    else expect(loaded.coins).toBe(state.coins + crop.yield * crop.sellPrice);
  });
  it('turns harvested starfruit into yogurt with milk and preserves it across saves', () => {
    const state = createFarmProgress();
    const crop = FARM_CROPS.starfruit;
    const recipe = FARM_RECIPES.starfruitYogurt;
    expect(CROP_IDS).toContain('starfruit');
    expect(buyFarmSeeds(state, 1, 'starfruit')).toBe(true);
    expect(farmAction(state, 0, 'till', 100)).toBe(true);
    expect(farmAction(state, 0, 'sow', 100, 'starfruit')).toBe(true);
    expect(farmAction(state, 0, 'water', 100)).toBe(true);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(state)));
    const harvestAt = 100 + crop.growMs;
    expect(farmAction(loaded, 0, 'harvest', harvestAt)).toBe(true);
    loaded.inventory.milk = recipe.ingredients.milk;
    expect(startFarmRecipe(loaded, 'starfruitYogurt', harvestAt, 'starfruit-yogurt')).toBe(true);
    expect(loaded.inventory.starfruit).toBe(crop.yield - recipe.ingredients.starfruit);
    expect(collectFarmRecipe(loaded, 'starfruit-yogurt', harvestAt + recipe.cookMs)).toBe(true);
    expect(loaded.inventory.starfruitYogurt).toBe(1);
  });
  it('cannot buy a Gem seed with coins, and migrates old wallets and crops without resetting', () => {
    const state = createFarmProgress();
    expect(buyFarmSeeds(state, 1, 'aloe')).toBe(false);
    state.coins = 12345;
    state.inventory.strawberry = 7;
    state.plots[0] = { stage: 'growing', wateredAt: 100 };
    const { gems: _, seeds: _s, kitchen: _k, ...legacy } = state;
    const loaded = parseFarmProgress(legacy);
    expect(loaded.coins).toBe(12345);
    expect(loaded.inventory.strawberry).toBe(7);
    expect(loaded.gems).toBe(0);
    expect(loaded.kitchen).toEqual([]);
    expect(farmAction(loaded, 0, 'harvest', 60100)).toBe(true);
    expect(loaded.inventory.strawberry).toBe(8);
  });
  it.each(['hen', 'duck', 'cow', 'sheep'] as const)(
    '%s collects the full product batch and preserves the animal',
    (species) => {
      const state = createFarmProgress();
      state.gems = 20;
      const definition = FARM_ANIMAL_CATALOG[species];
      const unit = species === 'hen' || species === 'duck' ? 'poultry' : 'livestock';
      const balance = state[definition.currency];
      expect(buyFarmAnimal(state, unit, species, 100)).toBe(true);
      expect(state[definition.currency]).toBe(balance - definition.price);
      const animal = (unit === 'poultry' ? state.poultry : state.animals)[0];
      expect(sellFarmAnimal(state, unit, 0, 100)).toBe(false);
      animal.ageMs = definition.maturityMs;
      animal.productionMs = definition.cycleMs;
      expect(collectFarmProducts(state, unit, 100)).toBe(1);
      expect(state.inventory[definition.product]).toBe(definition.yield);
      expect(collectFarmProducts(state, unit, 100)).toBe(0);
      expect(sellFarmAnimal(state, unit, 0, NaN)).toBe(false);
      expect(sellFarmAnimal(state, unit, 0, 100)).toBe(true);
      expect(state.coins).toBe(20000 - (definition.currency === 'coins' ? definition.price : 0) + definition.salePrice);
    },
  );
  it('buys, saves and sells dogs without harvesting or butchering them', () => {
    const state = createFarmProgress();
    state.gems = 2;
    expect(buyFarmAnimal(state, 'livestock', 'dog', 100)).toBe(true);
    expect(state.gems).toBe(1);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(state)));
    expect(loaded.animals[0].species).toBe('dog');
    expect(sellFarmAnimal(loaded, 'livestock', 0, 100)).toBe(false);
    loaded.animals[0].ageMs = FARM_ANIMAL_CATALOG.dog.maturityMs;
    expect(collectFarmProducts(loaded, 'livestock', 100)).toBe(0);
    expect(butcherFarmAnimal(loaded, 'livestock', 0, 100)).toBe(false);
    expect(sellFarmAnimal(loaded, 'livestock', 0, 100)).toBe(true);
    expect(loaded.animals).toHaveLength(0);
    expect(loaded.coins).toBe(state.coins + FARM_ANIMAL_CATALOG.dog.salePrice);
  });
  it('slaughter stores separate meat and never consumes an immature animal or adds coins', () => {
    const state = createFarmProgress();
    state.gems = 5;
    expect(buyFarmAnimal(state, 'livestock', 'cow', 0)).toBe(true);
    expect(butcherFarmAnimal(state, 'livestock', 0, 0)).toBe(false);
    state.animals[0].ageMs = 72 * HOUR_MS;
    expect(butcherFarmAnimal(state, 'livestock', 0, 0)).toBe(true);
    expect(state.inventory.beef).toBe(1);
    expect(state.animals).toHaveLength(0);
    expect(state.coins).toBe(20000);
  });
});
describe('kitchen and SDK transactions', () => {
  it('checks every ingredient before deducting anything and resumes cooking after reload', () => {
    const state = createFarmProgress();
    state.inventory.egg = 12;
    state.inventory.rice = 719;
    expect(startFarmRecipe(state, 'eggCake', 100, 'job')).toBe(false);
    expect(state.inventory.egg).toBe(12);
    expect(state.inventory.rice).toBe(719);
    state.inventory.rice = 720;
    expect(startFarmRecipe(state, 'eggCake', 100, 'job')).toBe(true);
    expect(state.inventory.egg).toBe(0);
    expect(state.inventory.rice).toBe(0);
    expect(startFarmRecipe(state, 'riceMeal', 100, 'second')).toBe(false);
    const loaded = parseFarmProgress(JSON.parse(JSON.stringify(state)));
    const ready = 100 + FARM_RECIPES.eggCake.cookMs;
    expect(collectFarmRecipe(loaded, 'job', ready - 1)).toBe(false);
    expect(collectFarmRecipe(loaded, 'job', ready)).toBe(true);
    expect(loaded.inventory.eggCake).toBe(1);
    expect(loaded.coins).toBe(20000);
    expect(collectFarmRecipe(loaded, 'job', ready)).toBe(false);
    expect(sellFarmItem(loaded, 'eggCake', 1)).toBe(true);
    expect(loaded.coins).toBe(25880);
  });
  it('serializes repeated cooking and collection commands without spending or granting twice', async () => {
    const document = createLocalDocument();
    document.farm.inventory.rice = 1440;
    let now = 100;
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => now,
    });
    const cook = { requestId: 'cook', mapInstanceId: 'home', type: 'cook', recipeId: 'riceMeal' } as const;
    expect((await sdk.execute(cook)).completed).toBe(1);
    await sdk.execute(cook);
    expect((await sdk.getMap(map)).farm.kitchen).toHaveLength(1);
    now += FARM_RECIPES.riceMeal.cookMs;
    const collect = { requestId: 'collect', mapInstanceId: 'home', type: 'collect-dish', jobId: 'cook' } as const;
    await sdk.execute(collect);
    await sdk.execute(collect);
    expect((await sdk.getInventory()).farm.inventory.riceMeal).toBe(1);
    await expect(sdk.execute({ ...collect, requestId: 'collect-again' })).rejects.toMatchObject({
      code: 'NOT_ALLOWED',
    });
    await expect(
      sdk.execute({ ...cook, requestId: 'bad', recipeId: 'invalid' } as unknown as Command),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  });
  it('a stale animal identifier cannot sell the next animal after a removal', async () => {
    const document = createLocalDocument();
    buyFarmAnimal(document.farm, 'poultry', 'hen', 100);
    buyFarmAnimal(document.farm, 'poultry', 'duck', 100);
    for (const animal of document.farm.poultry) animal.ageMs = FARM_ANIMAL_CATALOG[animal.species].maturityMs;
    const id = document.farm.poultry[0].id!;
    const sdk = createGameSdk({
      adapter: 'local',
      repository: createMemoryRepository(document),

      clock: () => 100,
    });
    const sell = {
      requestId: 'first',
      mapInstanceId: 'home',
      type: 'sell-animal',
      unit: 'poultry',
      animalId: id,
    } as const;
    expect((await sdk.execute(sell)).completed).toBe(1);
    await expect(sdk.execute({ ...sell, requestId: 'stale' })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await sdk.getMap(map)).farm.poultry[0].species).toBe('duck');
  });
});

it('shares Gem and seed wallets across map instances while keeping planted crops separate', async () => {
  const document = createLocalDocument();
  document.farm.gems = 3;
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(document),

    clock: () => 100,
  });
  const second = await sdk.getMap({ ...map, instanceId: 'second' });
  await sdk.execute({
    type: 'buy-seeds',
    cropId: 'aloe',
    count: 2,
    requestId: 'seeds',
    mapInstanceId: second.mapInstanceId,
  });
  await sdk.execute({ type: 'plot', index: 0, action: 'till', requestId: 'till', mapInstanceId: second.mapInstanceId });
  await sdk.execute({
    type: 'plot',
    index: 0,
    action: 'sow',
    cropId: 'aloe',
    requestId: 'sow',
    mapInstanceId: second.mapInstanceId,
  });
  const home = await sdk.getMap(map);
  expect(home.farm.gems).toBe(1);
  expect(home.farm.seeds.aloe).toBe(1);
  expect(home.farm.plots[0].stage).toBe('dry');
  expect((await sdk.getMap({ ...map, instanceId: 'second' })).farm.plots[0].cropId).toBe('aloe');
});
