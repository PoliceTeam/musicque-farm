import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { Command } from '@chibi-town/contracts';
import { decodeCharacterInventoryPage } from '@chibi-town/contracts/character-inventory';
import { cosmeticOffer, grantCharacterCosmetics, reservedArcadeCoins } from '@chibi-town/game-service';
import { describe, expect, it } from 'vitest';

function fixture() {
  const repository = createMemoryRepository(createLocalDocument());
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 1000,
  });
  let sequence = 0;

  const execute = (command: Input) =>
    sdk.execute({ ...command, mapInstanceId: 'home', requestId: `test-${++sequence}` } as Command);

  return { sdk, repository, execute };
}

// Keep discriminated command inference at call sites.
type Input = Command extends infer C ? (C extends Command ? Omit<C, 'requestId' | 'mapInstanceId'> : never) : never;

async function buy(t: ReturnType<typeof fixture>, id: string) {
  return t.execute({ type: 'buy-cosmetic', offerId: id } as Input);
}

describe('character ownership, containers and permanent colors', () => {
  it('migrates only the trusted worn equipment and colors once, retaining wallet and an empty bag', async () => {
    const t = fixture();
    const first = await t.sdk.getCharacterInventory({ view: 'equipped' });
    expect(first.rows.length).toBeGreaterThan(0);
    expect(first.bagUsed).toBe(0);
    expect(first.coins).toBe(30000);
    const state = await t.repository.transaction((document) => document.characterInventory!);
    expect(Object.keys(state.grants)).toEqual(['migration/v1']);
    expect(state.unlocks['item-color/shirt.tank/dark-purple']).toBeDefined();
    expect(state.unlocks['item-color/shirt.tank/red']).toBeUndefined();
    expect(state.unlocks['pet/cat']).toBeUndefined();
    expect(await t.sdk.getCharacterInventory({ view: 'equipped' })).toEqual(first);
  });
  it('rejects forged outfit/item/color commands instead of silently granting or sanitizing them', async () => {
    const t = fixture();
    await expect(
      t.sdk.execute({
        type: 'equip-outfit',
        outfit: { ...defaultOutfit, hat: 'hat.cap' },
        requestId: 'forged',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await expect(
      t.sdk.execute({
        type: 'apply-cosmetic-color',
        cosmeticId: 'item-color/shirt.tank/red',
        requestId: 'color',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await t.sdk.getPlayer()).outfit).toEqual(defaultOutfit);
  });
  it('buys once, moves without copies, equips from bag and warehouses the old collection separately', async () => {
    const t = fixture();
    const command = { type: 'buy-cosmetic', offerId: 'pet/cat', requestId: 'cat', mapInstanceId: 'home' } as const;
    const first = await t.sdk.execute(command);
    expect(first.farm.coins).toBe(25000);
    expect(await t.sdk.execute(command)).toEqual(first);
    await expect(buy(t, 'pet/cat')).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    let bag = await t.sdk.getCharacterInventory({ view: 'bag' });
    expect(bag.rows).toHaveLength(1);
    const instanceId = bag.rows[0].instance!.instanceId;
    await t.execute({ type: 'move-character-item', instanceId, to: 'warehouse' } as Input);
    await expect(t.execute({ type: 'equip-character-item', instanceId } as Input)).rejects.toMatchObject({
      code: 'NOT_ALLOWED',
    });
    await t.execute({ type: 'move-character-item', instanceId, to: 'bag' } as Input);
    await t.execute({ type: 'equip-character-item', instanceId } as Input);
    expect((await t.sdk.getPlayer()).outfit.pet).toBe('cat');
    bag = await t.sdk.getCharacterInventory({ view: 'bag' });
    expect(bag.rows).toHaveLength(0);
    await t.execute({ type: 'unequip-character-item', instanceId } as Input);
    expect((await t.sdk.getCharacterInventory({ view: 'bag' })).rows).toHaveLength(1);
    expect((await t.sdk.getPlayer()).outfit.pet).toBe('');
  });
  it('charges once for an item-specific color, preserves it through storage and never charges on reuse', async () => {
    const t = fixture();
    await buy(t, 'item-color/shirt.tank/red');
    const before = (await t.sdk.getInventory()).farm.coins;
    for (let i = 0; i < 3; i++) {
      await t.execute({ type: 'apply-cosmetic-color', cosmeticId: 'item-color/shirt.tank/red' } as Input);
      expect((await t.sdk.getPlayer()).outfit.shirtColor).toBe('Đỏ');
      await t.execute({ type: 'apply-cosmetic-color', cosmeticId: 'item-color/shirt.tank/dark-purple' } as Input);
    }
    expect((await t.sdk.getInventory()).farm.coins).toBe(before);
    await expect(buy(t, 'item-color/shirt.goku/red')).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    const shop = await t.sdk.getCharacterInventory({ view: 'shop', groupId: 'item/shirt.goku' });
    expect(shop.rows.find((row) => row.definition.id === 'item-color/shirt.goku/red')?.owned).toBe(false);
  });
  it('swaps into a full bag using the incoming slot; rejects unequip into a full bag and never removes required slots', async () => {
    const t = fixture();
    await buy(t, 'pet/cat');
    await buy(t, 'pet/corgi');
    await t.repository.transaction((document) => {
      document.characterInventory!.bagSlots = 2;
    });
    const bag = await t.sdk.getCharacterInventory({ view: 'bag' });
    const cat = bag.rows.find((row) => row.definition.id === 'pet/cat')!.instance!;
    const corgi = bag.rows.find((row) => row.definition.id === 'pet/corgi')!.instance!;
    await t.execute({ type: 'equip-character-item', instanceId: cat.instanceId } as Input);
    await t.repository.transaction((document) => {
      const state = document.characterInventory!;
      grantCharacterCosmetics(
        state,
        'quest/fill',
        ['pet/bunny'],
        { kind: 'quest', questId: 'fill', rewardId: 'pet' },
        1000,
      );
    });
    await expect(
      t.execute({ type: 'unequip-character-item', instanceId: cat.instanceId } as Input),
    ).rejects.toMatchObject({ code: 'INVENTORY_FULL' });
    await t.execute({ type: 'equip-character-item', instanceId: corgi.instanceId } as Input);
    expect((await t.sdk.getPlayer()).outfit.pet).toBe('corgi');
    expect((await t.sdk.getCharacterInventory({ view: 'bag' })).bagUsed).toBe(2);
    const equipped = await t.sdk.getCharacterInventory({ view: 'equipped' });
    const pants = equipped.rows.find((row) => row.definition.id === 'item/pants')!.instance!;
    await expect(
      t.execute({ type: 'unequip-character-item', instanceId: pants.instanceId } as Input),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  });
  it('sends trusted rewards to warehouse when the bag is full and cannot claim the same grant twice', async () => {
    const t = fixture();
    await t.sdk.getCharacterInventory({ view: 'bag' });
    await t.repository.transaction((document) => {
      const state = document.characterInventory!;
      state.bagSlots = 1;
      expect(
        grantCharacterCosmetics(
          state,
          'event/pets',
          ['pet/cat', 'pet/corgi'],
          { kind: 'event', eventId: 'pets', rewardId: 'one' },
          1000,
        ),
      ).toBe(true);
      expect(
        grantCharacterCosmetics(
          state,
          'event/pets',
          ['pet/cat', 'pet/corgi'],
          { kind: 'event', eventId: 'pets', rewardId: 'one' },
          1000,
        ),
      ).toBe(false);
    });
    expect((await t.sdk.getCharacterInventory({ view: 'bag' })).rows).toHaveLength(1);
    expect((await t.sdk.getCharacterInventory({ view: 'warehouse' })).rows).toHaveLength(1);
  });
  it('rejects spending reserved arcade money and rolls back both purchase and grant', async () => {
    const t = fixture();
    await t.repository.transaction((document) => {
      document.tableStakes = { diamonds: 29999 };
      expect(reservedArcadeCoins(document)).toBe(29999);
    });
    await expect(buy(t, 'pet/cat')).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
    expect((await t.sdk.getInventory()).farm.coins).toBe(30000);
    expect((await t.sdk.getCharacterInventory({ view: 'bag' })).rows).toHaveLength(0);
  });
  it('does not inherit Pet levels and paginates shop without duplicate IDs', async () => {
    const t = fixture();
    await buy(t, 'pet/cat');
    const after = (await t.sdk.getPlayer()).outfit;
    await expect(
      t.sdk.execute({
        type: 'equip-outfit',
        outfit: { ...after, pet: 'cat', petLevel: '2' },
        requestId: 'tier',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    const first = await t.sdk.getCharacterInventory({ view: 'shop', limit: 3 });
    expect(first.total).toBe(97);
    const shirts = await t.sdk.getCharacterInventory({ view: 'shop', slot: 'shirt' });
    expect(shirts.rows.every((row) => 'slot' in row.definition && row.definition.slot === 'shirt')).toBe(true);
    await expect(t.sdk.getCharacterInventory({ view: 'shop', slot: 'unknown-slot' })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
    const second = await t.sdk.getCharacterInventory({ view: 'shop', limit: 3, cursor: first.nextCursor! });
    expect(new Set([...first.rows, ...second.rows].map((row) => row.definition.id)).size).toBe(6);
    expect(first.rows[0].offer?.price.amount).toBe(cosmeticOffer(first.rows[0].definition.id).price.amount);
    await expect(t.sdk.getCharacterInventory({ view: 'shop', limit: 100 })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
  });
});

it('rejects malformed successful HTTP inventory responses before passing them to the renderer', async () => {
  const t = fixture();
  const page = await t.sdk.getCharacterInventory({ view: 'equipped' });
  expect(decodeCharacterInventoryPage(page)).toEqual(page);
  const broken = structuredClone(page);
  delete (broken.outfit as Partial<typeof broken.outfit>).hair;
  expect(() => decodeCharacterInventoryPage(broken)).toThrowError('Invalid character inventory response');
  const crossCharacter = structuredClone(page);
  crossCharacter.rows[0].instance!.characterId = 'someone-else';
  expect(() => decodeCharacterInventoryPage(crossCharacter)).toThrowError('Invalid character inventory response');
});
