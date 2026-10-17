import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { COSMETIC_CATALOG } from '@chibi-town/character-core/cosmetic-catalog';
import { pets } from '@chibi-town/character-core/item-catalog';
import { MAPS } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { petSheet } from '@/assets/asset-catalog';
import { npcUrls, petShopUrls } from '@/assets/generated-assets';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';

it('enters the pet shop, opens its employee or counter and leaves through the front aisle', () => {
  const shop = MAPS.find((map) => map.id === 'pet-shop')!;
  const street = MAPS.find((map) => map.id === 'shopping-street')!;
  expect(street.layers?.find((layer) => layer.id === 'pets')?.destination?.mapId).toBe(shop.id);
  expect(locationInputAt(shop, 800, 550)).toEqual({ kind: 'shop', shop: 'pets' });
  expect(locationInputAt(shop, 800, 420)).toEqual({ kind: 'shop', shop: 'pets' });
  expect(locationInputAt(shop, 800, 925)).toEqual({ kind: 'portal', portal: shop.portals[0] });
  expect(moveInLocation(shop, shop.spawn, [0, 90])[1]).toBeCloseTo(905);
  expect(moveInLocation(shop, [800, 550], [0, -100])[1]).toBeGreaterThanOrEqual(515);
  for (const layer of shop.layers ?? []) {
    if (layer.asset) expect(petShopUrls[layer.asset] ?? npcUrls[layer.asset], layer.asset).toBeTruthy();
    if (layer.pet) expect(petSheet.pieces[pets[layer.pet].piece]).toBeTruthy();
  }
  const cages = shop.layers!.filter((layer) => layer.id.startsWith('cages-'));
  expect(cages).toHaveLength(4);
  expect(cages.every((layer) => layer.asset?.startsWith('pet-shop:cage-display-'))).toBe(true);
  expect(shop.layers?.some((layer) => layer.id.startsWith('display-'))).toBe(false);
  expect(shop.layers?.find((layer) => layer.npc)).toBeTruthy();
});

it('sells and equips new base pets with aligned animation frames, while higher levels stay upgrade-only', async () => {
  const document = createLocalDocument();
  document.farm.coins = 1_000_000;
  const repository = createMemoryRepository(document);
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 1000,
  });
  const page = await sdk.getCharacterInventory({ view: 'shop', shop: 'pets', category: 'pet', limit: 50 });
  expect(page.rows.every((row) => row.definition.kind === 'pet' && row.definition.level === 1)).toBe(true);
  for (const family of ['ginger-cat', 'puppy', 'deer', 'panda', 'pig', 'turtle', 'clownfish', 'songbird']) {
    expect(page.rows.some((row) => row.definition.id === `pet/${family}`)).toBe(true);
    for (const level of [1, 2, 3]) {
      const pet = pets[family + (level === 1 ? '' : `.${level}`)];
      const frames = [pet.piece, ...(pet.walk ?? [])].map((id) => petSheet.pieces[id]);
      expect(new Set(frames.map((piece) => `${piece.width}:${piece.rows.length}`)).size).toBe(1);
    }
  }
  const before = (await sdk.getPlayer()).outfit;
  const trial = previewCosmetic(before, COSMETIC_CATALOG['pet/panda']);
  expect((await sdk.getPlayer()).outfit).toEqual(before);
  await sdk.execute({ type: 'buy-cosmetic', offerId: 'pet/panda', requestId: 'buy-panda', mapInstanceId: 'home' });
  await sdk.execute({ type: 'equip-outfit', outfit: trial, requestId: 'wear-panda', mapInstanceId: 'home' });
  expect((await sdk.getPlayer()).outfit.pet).toBe('panda');
  expect((await sdk.getInventory()).farm.coins).toBe(920_000);
  await expect(
    sdk.execute({ type: 'buy-cosmetic', offerId: 'pet/panda.2', requestId: 'high-panda', mapInstanceId: 'home' }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
});
