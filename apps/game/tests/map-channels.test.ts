import 'fake-indexeddb/auto';
import { createBrowserRepository, createGameSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import { decodeChannelDirectory, type GameSdk } from '@chibi-town/contracts';
import { describe, expect, it } from 'vitest';

const input = { regionId: 'fun', mapId: 'entertainment-street' };

function sdkPair() {
  const repository = createMemoryRepository();
  const local = createGameSdk({
    adapter: 'local',
    repository,

    channelPopulation: (_map, id, capacity) => (id === 2 ? capacity : id === 1 ? 5 : 0),
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://channels.test',

    fetch: async (url, init) => {
      try {
        const body = JSON.parse(String(init?.body));
        const result = String(url).endsWith('/join')
          ? await local.joinMapChannel(body)
          : await local.getMapChannels(body);
        return Response.json(result);
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

for (const adapter of ['local', 'http'] as const)
  describe(`${adapter} channels`, () => {
    it('returns configured channels, counts the player once and preserves the farm', async () => {
      const pair = sdkPair();
      const sdk: GameSdk = pair[adapter];
      const before = await pair.local.getInventory();
      const initial = await sdk.getMapChannels(input);
      expect(initial.source).toBe('mock');
      expect(initial.channels).toHaveLength(40);
      expect(initial.channels.map((entry) => entry.id)).toEqual(Array.from({ length: 40 }, (_, id) => id));
      expect(initial.channels.every((entry) => entry.capacity === 30)).toBe(true);
      expect(initial.currentChannelId).toBe(0);
      expect(initial.channels[0].occupants).toBe(1);
      const next = await sdk.joinMapChannel({ ...input, channelId: 1 });
      expect(next.currentChannelId).toBe(1);
      expect(next.channels[0].occupants).toBe(0);
      expect(next.channels[1].occupants).toBe(6);
      expect((await sdk.joinMapChannel({ ...input, channelId: 1 })).channels[1].occupants).toBe(6);
      expect((await pair.local.getInventory()).farm).toEqual(before.farm);
      expect((await pair.local.getInventory()).revision).toBe(before.revision);
    });
    it('rejects full, missing and invalid channels without changing the selected room', async () => {
      const sdk = sdkPair()[adapter];
      await sdk.joinMapChannel({ ...input, channelId: 1 });
      await expect(sdk.joinMapChannel({ ...input, channelId: 2 })).rejects.toMatchObject({ code: 'CHANNEL_FULL' });
      for (const channelId of [-1, 40, 1.5, Number.NaN])
        await expect(sdk.joinMapChannel({ ...input, channelId })).rejects.toMatchObject({ code: 'INVALID_CHANNEL' });
      expect((await sdk.getMapChannels(input)).currentChannelId).toBe(1);
      await expect(sdk.getMapChannels({ regionId: 'farm', mapId: 'farm-home' })).rejects.toMatchObject({
        code: 'MAP_NOT_FOUND',
      });
    });
  });
it('keeps the selected mock channel across SDK recreation and IndexedDB reload', async () => {
  const name = `channel-test-${crypto.randomUUID()}`;
  const first = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  await first.joinMapChannel({ ...input, channelId: 39 });
  const second = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await second.getMapChannels(input)).currentChannelId).toBe(39);
});
it('rejects malformed HTTP channel responses', async () => {
  const good = await sdkPair().local.getMapChannels(input);
  for (const bad of [
    { ...good, currentChannelId: 99 },
    { ...good, channels: [good.channels[0], good.channels[0]] },
    { ...good, channels: [{ id: 0, capacity: 30, occupants: 31 }] },
    { ...good, channels: [{ id: 0, capacity: 30, occupants: -1 }] },
    { ...good, source: 'random' },
  ])
    expect(() => decodeChannelDirectory(bad)).toThrow('Invalid channel response');
});
it('rejects an HTTP response for another map or another joined channel', async () => {
  const directory = await sdkPair().local.getMapChannels(input);
  const wrongMap = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://channels.test',

    fetch: async () => Response.json({ ...directory, mapId: 'other-map' }),
  });
  await expect(wrongMap.getMapChannels(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  const wrongMembership = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://channels.test',

    fetch: async () => Response.json(directory),
  });
  await expect(wrongMembership.joinMapChannel({ ...input, channelId: 1 })).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
  });
});
