import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { COSMETIC_CATALOG, type CosmeticId } from '@chibi-town/character-core/cosmetic-catalog';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { defaultOutfit, femaleOutfit, toEquip } from '@chibi-town/character-core/outfit-logic';
import { MAPS, REGIONS, validateWorld } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { sheet } from '@/assets/asset-catalog';
import { heldShopUrls, npcUrls } from '@/assets/generated-assets';
import { cosmeticThumbnailBounds } from '@/features/character/_utils/cosmetic-thumbnail';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';

const newItems = [
  'star-wand',
  'heart-wand',
  'moon-wand',
  'snow-wand',
  'sunflower-wand',
  'pink-guitar',
  'tennis-racket',
  'rose',
];

it('enters the handheld storefront and keeps the counter, front marker and exit usable', () => {
  const map = MAPS.find((entry) => entry.id === 'held-shop')!;
  expect(() => validateWorld({ regions: REGIONS, maps: MAPS })).not.toThrow();
  expect(
    MAPS.find((entry) => entry.id === 'shopping-street')?.layers?.find((layer) => layer.id === 'gifts')?.destination
      ?.mapId,
  ).toBe(map.id);
  expect(locationInputAt(map, 800, 550)).toEqual({ kind: 'shop', shop: 'accessories' });
  expect(locationInputAt(map, 800, 420)).toEqual({ kind: 'shop', shop: 'accessories' });
  expect(locationInputAt(map, 800, 925)).toEqual({ kind: 'portal', portal: map.portals[0] });
  expect(moveInLocation(map, map.spawn, [0, 90])[1]).toBeCloseTo(905);
  expect(moveInLocation(map, [800, 550], [0, -100])[1]).toBeGreaterThanOrEqual(525);
  for (const layer of map.layers ?? [])
    if (layer.asset) expect(heldShopUrls[layer.asset] ?? npcUrls[layer.asset], layer.asset).toBeTruthy();
  expect(map.layers?.find((layer) => layer.npc)).toBeTruthy();
});

it('renders every new handheld on both characters in standing/walking poses and mirrored views', () => {
  for (const id of newItems) {
    const item = items[`held.${id}`];
    expect(item.slot).toBe('held');
    for (const preset of [defaultOutfit, femaleOutfit]) {
      const equip = toEquip({ ...preset, held: item.id });
      expect(equip.some((entry) => items[entry.item].slot === 'grip')).toBe(true);
      for (const pose of [0, 1, 2, 3])
        for (const mirrored of [false, true]) {
          const ops = layoutAvatar(items, sheet, equip, pose, mirrored);
          const held = ops.find((op) => op.piece === item.poses[0].piece)!;
          expect(held).toBeTruthy();
          const bounds = cosmeticThumbnailBounds(sheet, [held]);
          expect(bounds.width).toBeGreaterThan(0);
          expect(bounds.height).toBeGreaterThan(0);
          // Shared preview has a fixed camera: all new items fit without zoom or crop changes.
          expect(bounds.top).toBeGreaterThan(-100);
          expect(bounds.top + bounds.height).toBeLessThan(33);
          expect(bounds.left).toBeGreaterThan(-66);
          expect(bounds.left + bounds.width).toBeLessThan(66);
        }
    }
  }
});

it('previews, buys and equips new handheld items using existing server ownership and coin rules', async () => {
  const document = createLocalDocument();
  document.farm.coins = 1_000_000;
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(document),

    clock: () => 1000,
  });
  const page = await sdk.getCharacterInventory({ view: 'shop', shop: 'accessories', slot: 'held', limit: 50 });
  expect(page.rows).toHaveLength(12);
  expect(page.rows.every((row) => 'slot' in row.definition && row.definition.slot === 'held')).toBe(true);
  for (const name of newItems) {
    const id = `item/held.${name}` as CosmeticId;
    expect(page.rows.some((row) => row.definition.id === id)).toBe(true);
    const original = (await sdk.getPlayer()).outfit;
    const trial = previewCosmetic(original, COSMETIC_CATALOG[id]);
    expect((await sdk.getPlayer()).outfit).toEqual(original);
    await expect(
      sdk.execute({ type: 'equip-outfit', outfit: trial, mapInstanceId: 'home', requestId: `unowned-${id}` }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    const command = { type: 'buy-cosmetic' as const, offerId: id, requestId: id, mapInstanceId: 'home' };
    await sdk.execute(command);
    await sdk.execute(command);
    await sdk.execute({ type: 'equip-outfit', outfit: trial, mapInstanceId: 'home', requestId: `wear-${id}` });
    expect((await sdk.getPlayer()).outfit.held).toBe(`held.${name}`);
  }
  expect((await sdk.getInventory()).farm.coins).toBe(680_000);
});
