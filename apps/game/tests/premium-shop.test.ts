import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { MAPS, REGIONS, validateWorld } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { npcUrls, premiumShopUrls } from '@/assets/generated-assets';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';

it('enters Premium through its storefront and keeps the employee, front marker and exit usable', () => {
  const map = MAPS.find((entry) => entry.id === 'premium-shop')!;
  expect(() => validateWorld({ regions: REGIONS, maps: MAPS })).not.toThrow();
  const storefront = MAPS.find((entry) => entry.id === 'shopping-street')?.layers?.find(
    (layer) => layer.id === 'premium',
  );
  expect(storefront?.destination?.mapId).toBe(map.id);
  expect(storefront?.shop).toBeUndefined();
  expect(locationInputAt(map, 800, 550)).toEqual({ kind: 'shop', shop: 'premium' });
  expect(locationInputAt(map, 800, 420)).toEqual({ kind: 'shop', shop: 'premium' });
  expect(locationInputAt(map, 800, 925)).toEqual({ kind: 'portal', portal: map.portals[0] });
  expect(map.portals[0].spawn).toEqual([1205, 580]);
  expect(moveInLocation(map, map.spawn, [0, 90])[1]).toBeCloseTo(905);
  expect(moveInLocation(map, [800, 550], [0, -100])[1]).toBeGreaterThanOrEqual(510);
  expect(moveInLocation(map, [800, 815], [0, -220])[1]).toBeCloseTo(595);
  for (const layer of map.layers ?? [])
    if (layer.asset) expect(premiumShopUrls[layer.asset] ?? npcUrls[layer.asset], layer.asset).toBeTruthy();
  expect(map.layers?.find((layer) => layer.npc)).toBeTruthy();
});

it('retains Premium coin prices, first-level policy and separate item tabs in its inventory queries', async () => {
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(createLocalDocument()),

    clock: () => 1000,
  });
  for (const [slot, amount] of [
    ['hair', 200_000],
    ['pants', 140_000],
    ['shirt', 180_000],
    ['shoes', 100_000],
    ['wrist', 60_000],
  ] as const) {
    const page = await sdk.getCharacterInventory({ view: 'shop', shop: 'premium', slot });
    expect(page.rows).toHaveLength(1);
    const item = page.rows[0];
    expect(item.offer?.price).toEqual({ currency: 'coins', amount });
    expect('slot' in item.definition && item.definition.slot).toBe(slot);
    expect(!('level' in item.definition) || item.definition.level === 1 || item.definition.level === undefined).toBe(
      true,
    );
  }
});
