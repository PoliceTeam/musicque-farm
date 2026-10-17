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

it('uses the original Goku palette for trial, purchase and equip, retaining purchased alternate colors', async () => {
  const { sdk, repository } = fixture();
  for (const [id, field, expected] of [
    ['item/shirt.goku', 'shirtColor', 'Cam'],
    ['item/pants.goku', 'pantsColor', 'Cam'],
    ['item/shoes.goku', 'shoesColor', 'Xanh'],
    ['item/wrist.goku', 'wristColor', 'Xanh'],
  ] as const) {
    const entry = COSMETIC_CATALOG[id];
    const outfit = previewCosmetic((await sdk.getPlayer()).outfit, entry);
    expect(outfit[field]).toBe(expected);
    const offer = cosmeticOffer(id);
    expect(
      offer.reward.cosmeticIds.some((colorId) =>
        Object.values(COSMETIC_CATALOG).some(
          (color) => color.id === colorId && color.kind === 'item-color' && color.colorValue === expected,
        ),
      ),
    ).toBe(true);
    await sdk.execute({ type: 'buy-cosmetic', offerId: id, requestId: id, mapInstanceId: 'home' });
    await sdk.execute({ type: 'equip-outfit', outfit, requestId: `${id}/wear`, mapInstanceId: 'home' });
    expect((await sdk.getPlayer()).outfit[field]).toBe(expected);
  }
  const alternate = Object.values(COSMETIC_CATALOG).find(
    (entry) => entry.kind === 'item-color' && entry.requires === 'item/shirt.goku' && entry.colorValue === 'Đỏ',
  )!;
  await sdk.execute({ type: 'buy-cosmetic', offerId: alternate.id, requestId: 'red-goku', mapInstanceId: 'home' });
  await sdk.execute({
    type: 'equip-outfit',
    outfit: { ...(await sdk.getPlayer()).outfit, shirtColor: 'Đỏ' },
    requestId: 'wear-red-goku',
    mapInstanceId: 'home',
  });
  // Emulate an old shop grant that lacked the canonical orange palette.
  await repository.transaction((document) => {
    delete document.characterInventory!.unlocks['item-color/shirt.goku/orange'];
  });
  const coins = (await sdk.getInventory()).farm.coins;
  const repaired = await sdk.getCharacterInventory({ view: 'shop', shop: 'premium', groupId: 'item/shirt.goku' });
  expect(repaired.rows.find((row) => row.definition.id === 'item-color/shirt.goku/orange')?.owned).toBe(true);
  expect(repaired.rows.find((row) => row.definition.id === alternate.id)?.owned).toBe(true);
  expect((await sdk.getPlayer()).outfit.shirtColor).toBe('Đỏ');
  expect((await sdk.getInventory()).farm.coins).toBe(coins);
});

it('layers trial choices across slots and colors while purchases leave the real outfit unchanged', async () => {
  const { sdk } = fixture();
  const real = (await sdk.getPlayer()).outfit;
  const hair = previewCosmetic(real, COSMETIC_CATALOG['item-color/hair.slick/blue']);
  const shirt = previewCosmetic(hair, COSMETIC_CATALOG['item/shirt.goku']);
  const pants = previewCosmetic(shirt, COSMETIC_CATALOG['item/pants.goku']);
  const skin = Object.values(COSMETIC_CATALOG).find((entry) => entry.kind === 'skin-color')!;
  const combined = previewCosmetic(pants, skin);
  expect(combined).toMatchObject({
    hair: 'hair.slick',
    hairColor: 'Xanh dương',
    shirt: shirt.shirt,
    shirtColor: 'Cam',
    pants: pants.pants,
    pantsColor: 'Cam',
  });
  expect(combined.skin).toBe(skin.kind === 'skin-color' && skin.colorValue);
  const changedHair = previewCosmetic(combined, COSMETIC_CATALOG['item/hair.goku.1']);
  expect(changedHair).toMatchObject({
    shirt: combined.shirt,
    shirtColor: combined.shirtColor,
    pants: combined.pants,
    pantsColor: combined.pantsColor,
    skin: combined.skin,
  });
  expect(combined.hair).toBe('hair.slick');
  expect(real).toEqual(defaultOutfit);
  await sdk.execute({
    type: 'buy-cosmetic',
    offerId: 'item/shirt.goku',
    requestId: 'trial-shirt',
    mapInstanceId: 'home',
  });
  expect((await sdk.getPlayer()).outfit).toEqual(real);
  // Using the purchased item applies that item, not unrelated unowned trial pieces.
  const wear = previewCosmetic((await sdk.getPlayer()).outfit, COSMETIC_CATALOG['item/shirt.goku']);
  await sdk.execute({ type: 'equip-outfit', outfit: wear, requestId: 'wear-trial-shirt', mapInstanceId: 'home' });
  expect((await sdk.getPlayer()).outfit).toMatchObject({ hair: real.hair, pants: real.pants, shirt: shirt.shirt });
});
