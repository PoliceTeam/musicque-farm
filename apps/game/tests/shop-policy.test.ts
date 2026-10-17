import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { COSMETIC_CATALOG } from '@chibi-town/character-core/cosmetic-catalog';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { cosmeticOffer } from '@chibi-town/game-service';
import { expect, it } from 'vitest';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';

function fixture(legacy = false) {
  const document = createLocalDocument();
  document.farm.coins = 1_000_000;
  if (legacy) document.outfit = { ...defaultOutfit, hair: 'hair.goku', hairLevel: '3' };
  const repository = createMemoryRepository(document);
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 1000,
  });
  return { sdk, repository };
}

it('separates Premium from salon and exposes only the lowest family level, even in group details', async () => {
  const { sdk } = fixture();
  const salon = await sdk.getCharacterInventory({ view: 'shop', shop: 'salon', slot: 'hair', limit: 50 });
  expect(salon.rows.length).toBeGreaterThan(0);
  expect(salon.rows.every((row) => row.offer?.shop === 'salon')).toBe(true);
  expect(salon.rows.some((row) => row.definition.groupId === 'item/hair.goku')).toBe(false);
  expect(salon.rows.every((row) => !('gender' in row.definition) || row.definition.gender !== 'female')).toBe(true);
  const premium = await sdk.getCharacterInventory({
    view: 'shop',
    shop: 'premium',
    groupId: 'item/hair.goku',
    limit: 50,
  });
  expect(premium.rows.some((row) => row.definition.id === 'item/hair.goku.1')).toBe(true);
  expect(premium.rows.every((row) => !('level' in row.definition) || row.definition.level === 1)).toBe(true);
  expect(await sdk.getCharacterInventory({ view: 'shop', shop: 'salon', groupId: 'item/hair.goku' })).toMatchObject({
    total: 0,
  });
});

it('rejects direct purchases of higher levels and their colors without changing ownership or wallet', async () => {
  const { sdk } = fixture();
  const before = await sdk.getInventory();
  for (const id of ['item/hair.goku.2', 'item-color/hair.goku.2/black', 'pet/cat.2']) {
    expect(cosmeticOffer(id).enabled).toBe(false);
    await expect(
      sdk.execute({ type: 'buy-cosmetic', offerId: id, mapInstanceId: 'home', requestId: id }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  }
  expect((await sdk.getInventory()).farm.coins).toBe(before.farm.coins);
  expect((await sdk.getCharacterInventory({ view: 'bag' })).total).toBe(0);
});

it('charges the configured Premium coin price exactly once and preserves legacy upgraded ownership', async () => {
  const { sdk, repository } = fixture();
  const command = {
    type: 'buy-cosmetic',
    offerId: 'item/hair.goku.1',
    requestId: 'premium-hair',
    mapInstanceId: 'home',
  } as const;
  await sdk.execute(command);
  await sdk.execute(command);
  expect((await sdk.getInventory()).farm.coins).toBe(800_000);
  const source = await repository.transaction(
    (document) => document.characterInventory!.grants['shop/premium-hair'].source,
  );
  expect(source).toEqual({
    kind: 'shop',
    offerId: 'item/hair.goku.1',
    shop: 'premium',
    paid: { currency: 'coins', amount: 200_000 },
  });
  expect((await sdk.getCharacterInventory({ view: 'bag' })).rows.map((row) => row.definition.id)).toContain(
    'item/hair.goku.1',
  );
  const old = fixture(true);
  expect((await old.sdk.getCharacterInventory({ view: 'equipped' })).rows.map((row) => row.definition.id)).toContain(
    'item/hair.goku.3',
  );
  expect((await old.sdk.getPlayer()).outfit.hairLevel).toBe('3');
});

it('previews base items and their colors without mutating or granting the real outfit', async () => {
  const { sdk } = fixture();
  const original = { ...defaultOutfit };
  const preview = previewCosmetic(original, COSMETIC_CATALOG['item-color/hair.slick/blue']);
  expect(preview).toMatchObject({ hair: 'hair.slick', hairColor: 'Xanh dương' });
  expect(original).toEqual(defaultOutfit);
  await expect(
    sdk.execute({ type: 'equip-outfit', outfit: preview, mapInstanceId: 'home', requestId: 'unowned-preview' }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  expect((await sdk.getPlayer()).outfit).toEqual(defaultOutfit);
});
