import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { MAPS, SHOP_NPC_ROLES } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { fashionShopUrls, heldShopUrls, jewelryShopUrls, npcUrls } from '@/assets/generated-assets';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';

it('keeps all twenty shop employees available and assigns each open shop its matching employee', () => {
  expect(SHOP_NPC_ROLES).toHaveLength(20);
  for (const role of SHOP_NPC_ROLES) expect(npcUrls[`npc:${role}`]).toBeTruthy();
  for (const [id, role] of [
    ['salon', 'salon'],
    ['pet-shop', 'pets'],
    ['held-shop', 'held'],
    ['premium-shop', 'premium'],
    ['jewelry-shop', 'jewelry'],
    ['fashion-shop', 'store'],
  ]) {
    const map = MAPS.find((entry) => entry.id === id)!;
    const employee = map.layers?.find((layer) => layer.npc);
    expect(employee?.npc).toBe(role);
    expect(employee?.asset).toBe(`npc:${role}`);
  }
});

it.each([
  ['jewelry-shop', 'jewelry'],
  ['fashion-shop', 'fashion'],
])('makes %s accessible with a clear aisle and counter marker', (id, shop) => {
  const map = MAPS.find((entry) => entry.id === id)!;
  expect(map.presentation).toBe('interior');
  expect(locationInputAt(map, 800, 580)).toEqual({ kind: 'shop', shop });
  expect(locationInputAt(map, 800, 925)).toEqual({ kind: 'portal', portal: map.portals[0] });
  expect(moveInLocation(map, map.spawn, [0, -220])).toEqual([800, 595]);
  expect(moveInLocation(map, map.spawn, [0, 90])[1]).toBeCloseTo(905);
  for (const layer of map.layers ?? [])
    if (layer.asset)
      expect(
        jewelryShopUrls[layer.asset] ??
          fashionShopUrls[layer.asset] ??
          heldShopUrls[layer.asset] ??
          npcUrls[layer.asset],
        layer.asset,
      ).toBeTruthy();
});

it('sells ordinary first-level clothes through separate fashion slots', async () => {
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(createLocalDocument()),

    clock: () => 1000,
  });
  for (const slot of ['shirt', 'pants', 'shoes'] as const) {
    const page = await sdk.getCharacterInventory({ view: 'shop', shop: 'fashion', slot });
    expect(page.rows.length).toBeGreaterThan(0);
    for (const item of page.rows) {
      expect('slot' in item.definition && item.definition.slot).toBe(slot);
      expect(!('level' in item.definition) || !item.definition.level || item.definition.level === 1).toBe(true);
      expect(item.definition.id).not.toContain('goku');
      expect(item.offer?.price.currency).toBe('coins');
    }
  }
});
