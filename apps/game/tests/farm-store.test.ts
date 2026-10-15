import { createGameSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import type { GameSdk, Snapshot } from '@chibi-town/contracts';
import { expect, it } from 'vitest';
import { createFarmStore } from '@/features/farm/farm-store';

it('retries an uncertain network failure with the same command ID', async () => {
  const local = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
  let fail = true;
  const ids: string[] = [];
  const sdk: GameSdk = {
    ...local,

    async execute(command) {
      ids.push(command.requestId);
      const result = await local.execute(command);
      if (fail) {
        fail = false;
        throw new Error('Connection lost after commit');
      }
      return result;
    },
  };
  const model = createFarmStore(sdk);
  await model.refresh();
  await expect(model.execute({ type: 'plot', index: 6, action: 'buy' })).rejects.toThrow();
  await model.execute({ type: 'plot', index: 6, action: 'buy' });
  expect(ids[0]).toBe(ids[1]);
  expect(model.store.getState().snapshot?.farm.owned).toBe(7);
  expect(model.store.getState().snapshot?.farm.coins).toBe(19200);
});
it('a late older snapshot cannot overwrite a completed command', async () => {
  const local = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
  const stale = await local.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'home' });

  let release: (value: Snapshot) => void = () => {};

  const sdk: GameSdk = {
    ...local,

    getMap: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  };
  const model = createFarmStore(sdk);
  const refresh = model.refresh();
  await Promise.resolve();
  await Promise.resolve();
  await model.execute({ type: 'plot', index: 6, action: 'buy' });
  release(stale);
  await refresh;
  expect(model.store.getState().snapshot?.farm.owned).toBe(7);
});

it('commands use the concrete instance returned by the SDK', async () => {
  const local = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
  const snapshot = await local.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'home' });
  let instance = '';
  const sdk: GameSdk = {
    ...local,

    getMap: async () => ({ ...snapshot, mapInstanceId: 'farm-second:home' }),

    execute: async (command) => {
      instance = command.mapInstanceId;
      return { ...snapshot, mapInstanceId: instance, completed: 1, eligible: 1 };
    },
  };
  const model = createFarmStore(sdk, { regionId: 'farm', mapId: 'farm-second', instanceId: 'home' });
  await model.refresh();
  await model.execute({ type: 'plot', index: 6, action: 'buy' });
  expect(instance).toBe('farm-second:home');
});

it('starts the farm snapshot request while player identity is still loading', async () => {
  const local = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
  let resolvePlayer!: (player: Awaited<ReturnType<GameSdk['getPlayer']>>) => void;
  let mapRequested = false;
  const sdk: GameSdk = {
    ...local,

    getPlayer: () =>
      new Promise((resolve) => {
        resolvePlayer = resolve;
      }),

    getMap: async (input) => {
      mapRequested = true;
      return local.getMap(input);
    },
  };
  const model = createFarmStore(sdk);
  const refresh = model.refresh();
  expect(mapRequested).toBe(true);
  resolvePlayer(await local.getPlayer());
  await refresh;
  expect(model.store.getState().snapshot).toBeDefined();
  expect(model.store.getState().player).toBeDefined();
});
