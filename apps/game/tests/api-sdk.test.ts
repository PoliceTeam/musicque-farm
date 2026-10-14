import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import type { Command, GameSdk } from '@chibi-town/contracts';
import { createFarmProgress } from '@chibi-town/gameplay';
import { describe, expect, it } from 'vitest';

const map = { regionId: 'farm', mapId: 'farm-home', instanceId: 'home' };

const command = (requestId: string): Command => ({
  requestId,
  mapInstanceId: 'home',
  type: 'plot',
  index: 0,
  action: 'till',
});

function fixtures() {
  const document = createLocalDocument();
  document.farm.plots[0].stage = 'ripe';
  let now = 1000;
  const local = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(document),

    clock: () => now,
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://test.invalid',

    fetch: async (url, init) => {
      try {
        const path = String(url).replace('https://test.invalid', '');
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const result =
          path === '/commands'
            ? await local.execute(body)
            : path === '/maps/snapshot'
              ? await local.getMap(body)
              : path === '/inventory'
                ? await local.getInventory()
                : path === '/player'
                  ? await local.getPlayer()
                  : await local.getWorld();
        return new Response(JSON.stringify(result), { status: 200 });
      } catch (error) {
        return new Response(JSON.stringify(error), { status: 400 });
      }
    },
  });
  return {
    local,
    http,

    advance: () => {
      now += 1000;
    },
  };
}

for (const adapter of ['local', 'http'] as const)
  describe(`${adapter} SDK contract`, () => {
    it('harvest stores goods without adding money; explicit sale adds money once', async () => {
      const sdk: GameSdk = fixtures()[adapter];
      const before = await sdk.getMap(map);
      const harvest = {
        requestId: 'harvest',
        mapInstanceId: 'home',
        type: 'plot',
        index: 0,
        action: 'harvest',
      } as const;
      const after = await sdk.execute(harvest);
      expect(after.farm.coins).toBe(before.farm.coins);
      expect(after.farm.inventory.strawberry).toBe(1);
      expect(await sdk.execute(harvest)).toEqual(after);
      const sold = await sdk.execute({
        requestId: 'sale',
        mapInstanceId: 'home',
        type: 'sell',
        product: 'strawberry',
        count: 1,
      });
      expect(sold.farm.coins).toBe(before.farm.coins + 35);
      expect(sold.farm.inventory.strawberry).toBe(0);
    });
    it('rejects a reused request ID with different intent and preserves state', async () => {
      const sdk = fixtures()[adapter];
      await sdk.execute({ requestId: 'once', mapInstanceId: 'home', type: 'plot', index: 1, action: 'till' });
      await expect(
        sdk.execute({ requestId: 'once', mapInstanceId: 'home', type: 'plot', index: 2, action: 'till' }),
      ).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
      expect((await sdk.getMap(map)).farm.plots[2].stage).toBe('dry');
    });
    it('invalid units and commands are domain errors', async () => {
      const sdk = fixtures()[adapter];
      await expect(
        sdk.execute({ ...command('bad'), type: 'feed', unit: 'invalid' } as unknown as Command),
      ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      await expect(sdk.getMap({ ...map, mapId: 'missing' })).rejects.toMatchObject({ code: 'MAP_NOT_FOUND' });
    });
  });
it('IndexedDB imports legacy save once and serializes commands from two clients', async () => {
  const legacy = createFarmProgress();
  legacy.coins = 12345;
  legacy.owned = 7;
  legacy.inventory.strawberry = 3;
  const name = `test-${Math.random()}`;
  let imports = 0;
  const repository = createBrowserRepository({
    name,

    legacy: () => {
      imports++;
      return legacy;
    },
  });
  const first = createGameSdk({ adapter: 'local', repository });
  const second = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await first.getMap(map)).farm.coins).toBe(12345);
  await Promise.all([first.execute(command('same')), second.execute(command('same'))]);
  expect((await second.getMap(map)).revision).toBe(1);
  expect(imports).toBe(1);
  await expect(
    first.execute({ requestId: 'bad-sale', mapInstanceId: 'home', type: 'sell', product: 'strawberry', count: 99 }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  expect((await second.getMap(map)).farm.inventory.strawberry).toBe(3);
});
it('snapshots are isolated from consumer mutation', async () => {
  const sdk = fixtures().local;
  const before = await sdk.getMap(map);
  before.farm.coins = 0;
  expect((await sdk.getMap(map)).farm.coins).toBe(20000);
});
it('simulated connection errors do not mutate local progress', async () => {
  const repository = createMemoryRepository();
  const failing = createGameSdk({
    adapter: 'local',
    repository,

    fail: () => true,
  });
  await expect(failing.execute(command('offline'))).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  const normal = createGameSdk({ adapter: 'local', repository });
  expect((await normal.getMap(map)).farm.plots[0].stage).toBe('dry');
});
it('multiple map instances keep land separate and share the player wallet/inventory', async () => {
  const { MAPS, REGIONS } = await import('@chibi-town/game-content');
  const extra = { ...MAPS[0], id: 'farm-second' };
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(),
    world: {
      regions: REGIONS.map((region) =>
        region.id === 'farm' ? { ...region, maps: ['farm-home', 'farm-second'] } : region,
      ),
      maps: [...MAPS, extra],
    },
  });
  const second = await sdk.getMap({ regionId: 'farm', mapId: 'farm-second', instanceId: 'home' });
  await sdk.execute({
    type: 'plot',
    index: 0,
    action: 'till',
    mapInstanceId: second.mapInstanceId,
    requestId: 'second-plot',
  });
  await sdk.execute({
    type: 'plot',
    index: 6,
    action: 'buy',
    mapInstanceId: second.mapInstanceId,
    requestId: 'second-buy',
  });
  const first = await sdk.getMap(map);
  expect(first.farm.plots[0].stage).toBe('dry');
  expect(first.farm.owned).toBe(6);
  expect(first.farm.coins).toBe(9200);
  expect((await sdk.getMap({ regionId: 'farm', mapId: 'farm-second', instanceId: 'home' })).farm.owned).toBe(7);
});
it('HTTP adapter rejects malformed successful responses', async () => {
  const sdk = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://test.invalid',

    fetch: async () => new Response('{"revision":0}', { status: 200 }),
  });
  await expect(sdk.getInventory()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
});

it('keeps separate instances of the same map independent', async () => {
  const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
  const second = await sdk.getMap({ ...map, instanceId: 'second' });
  await sdk.execute({
    type: 'plot',
    index: 6,
    action: 'buy',
    requestId: 'second-plot',
    mapInstanceId: second.mapInstanceId,
  });
  expect((await sdk.getMap(map)).farm.owned).toBe(6);
  expect((await sdk.getMap({ ...map, instanceId: 'second' })).farm.owned).toBe(7);
  expect((await sdk.getMap(map)).farm.coins).toBe(9200);
});
