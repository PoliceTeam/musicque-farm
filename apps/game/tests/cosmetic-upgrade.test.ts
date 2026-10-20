import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { decodeCharacterInventoryPage } from '@chibi-town/contracts/character-inventory';
import { describe, expect, it } from 'vitest';

function fixture(coins = 2_000_000) {
  const document = createLocalDocument();
  document.farm.coins = coins;
  const repository = createMemoryRepository(document);
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 1000,
  });
  return { sdk, repository };
}

async function buy(t: ReturnType<typeof fixture>, id: string) {
  await t.sdk.execute({ type: 'buy-cosmetic', offerId: id, requestId: `buy-${id}`, mapInstanceId: 'home' });
  return (
    await t.sdk.getCharacterInventory({
      view: 'owned',
      groupId: id.startsWith('pet/') ? id : id.replace(/\.\d+$/, ''),
      limit: 50,
    })
  ).rows.find((row) => row.definition.id === id)!;
}

function upgrade(instanceId: string, targetId: string, requestId: string) {
  return { type: 'upgrade-character-item' as const, instanceId, targetId, requestId, mapInstanceId: 'home' };
}

describe('cosmetic level unlocks', () => {
  it('charges once, grants only the next level and keeps earlier items and ownership', async () => {
    const t = fixture();
    const base = await buy(t, 'item/hat.cap.1');
    expect(base.upgrade).toMatchObject({ target: { id: 'item/hat.cap.2' }, price: { amount: 25_000 }, owned: false });
    const input = upgrade(base.instance!.instanceId, 'item/hat.cap.2', 'upgrade');
    const [first, replay] = await Promise.all([t.sdk.execute(input), t.sdk.execute(input)]);
    expect(first).toEqual(replay);
    expect(first.farm.coins).toBe(1_935_000);
    const bag = await t.sdk.getCharacterInventory({ view: 'bag', groupId: 'item/hat.cap' });
    expect(bag.rows.map((row) => row.definition.id)).toEqual(['item/hat.cap.1', 'item/hat.cap.2']);
    await expect(t.sdk.execute({ ...input, requestId: 'another-id' })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await t.sdk.getInventory()).farm.coins).toBe(first.farm.coins);
    const group = await t.sdk.getCharacterInventory({ view: 'upgrades' });
    expect(group.rows.find((row) => row.definition.groupId === 'item/hat.cap')?.definition.id).toBe('item/hat.cap.2');
    expect(decodeCharacterInventoryPage(group)).toEqual(group);
  });
  it('carries every owned palette and replaces worn equipment while keeping its selected dye', async () => {
    const t = fixture();
    const base = await buy(t, 'item/hair.goku.1');
    await buy(t, 'item-color/hair.goku.1/blond');
    await t.sdk.execute({
      type: 'equip-character-item',
      instanceId: base.instance!.instanceId,
      requestId: 'wear',
      mapInstanceId: 'home',
    });
    await t.sdk.execute({
      type: 'apply-cosmetic-color',
      cosmeticId: 'item-color/hair.goku.1/blond',
      requestId: 'dye',
      mapInstanceId: 'home',
    });
    const result = await t.sdk.execute(upgrade(base.instance!.instanceId, 'item/hair.goku.2', 'level-2'));
    expect(result.outfit).toMatchObject({ hair: 'hair.goku', hairLevel: '2', hairColor: 'Vàng' });
    const owned = await t.sdk.getCharacterInventory({ view: 'owned', groupId: 'item/hair.goku', limit: 50 });
    expect(owned.rows.find((row) => row.definition.id === 'item-color/hair.goku.2/blond')?.owned).toBe(true);
    expect(owned.rows.find((row) => row.definition.id === 'item/hair.goku.1')?.instance?.location.container).toBe(
      'bag',
    );
    const next = owned.rows.find((row) => row.definition.id === 'item/hair.goku.2')!;
    expect(next.instance).toMatchObject({
      location: { container: 'equipped', slot: 'hair' },
      colorUnlockId: 'item-color/hair.goku.2/blond',
    });
    const grant = await t.repository.transaction((document) => document.characterInventory!.grants['upgrade/level-2']);
    expect(grant.source).toMatchObject({
      kind: 'upgrade',
      from: 'item/hair.goku.1',
      to: 'item/hair.goku.2',
      paid: { amount: 50_000 },
    });
  });
  it('upgrades equipped pets, supports a full bag, and preserves warehouse placement', async () => {
    const t = fixture();
    const pet = await buy(t, 'pet/cat');
    await t.sdk.execute({
      type: 'equip-character-item',
      instanceId: pet.instance!.instanceId,
      requestId: 'wear',
      mapInstanceId: 'home',
    });
    await t.repository.transaction((document) => {
      document.characterInventory!.bagSlots = 0;
    });
    const nextId = pet.upgrade!.target!.id;
    const result = await t.sdk.execute(upgrade(pet.instance!.instanceId, nextId, 'pet-2'));
    expect(result.outfit).toMatchObject({ pet: 'cat', petLevel: '2' });
    const old = (await t.sdk.getCharacterInventory({ view: 'warehouse' })).rows.find(
      (row) => row.definition.id === 'pet/cat',
    );
    expect(old).toBeDefined();
    const fresh = (await t.sdk.getCharacterInventory({ view: 'equipped' })).rows.find(
      (row) => row.definition.id === nextId,
    )!;
    expect(fresh.upgrade?.target).not.toBeNull();
    const cap = await buy(t, 'item/hat.cap.1');
    expect(cap.instance!.location.container).toBe('warehouse');
    await t.sdk.execute(upgrade(cap.instance!.instanceId, 'item/hat.cap.2', 'stored-2'));
    expect((await t.sdk.getCharacterInventory({ view: 'warehouse', groupId: 'item/hat.cap' })).rows).toHaveLength(2);
  });
  it('rejects skipped levels, unrelated targets, forged/foreign instances and spending reserved coins atomically', async () => {
    const t = fixture();
    const base = await buy(t, 'item/hat.cap.1');
    const coins = (await t.sdk.getInventory()).farm.coins;
    for (const [instance, target] of [
      [base.instance!.instanceId, 'item/hat.cap.3'],
      [base.instance!.instanceId, 'item/hat.beanie.2'],
      ['not-owned', 'item/hat.cap.2'],
    ])
      await expect(t.sdk.execute(upgrade(instance, target, `bad-${target}-${instance}`))).rejects.toMatchObject({
        code: 'NOT_ALLOWED',
      });
    await t.repository.transaction((document) => {
      document.tableStakes = { 'tien-len': document.farm.coins - 1 };
    });
    await expect(t.sdk.execute(upgrade(base.instance!.instanceId, 'item/hat.cap.2', 'reserved'))).rejects.toMatchObject(
      { code: 'INSUFFICIENT_COINS' },
    );
    expect((await t.sdk.getInventory()).farm.coins).toBe(coins);
    expect(
      (await t.sdk.getCharacterInventory({ view: 'owned', groupId: 'item/hat.cap' })).rows.some(
        (row) => row.definition.id === 'item/hat.cap.2',
      ),
    ).toBe(false);
  });
  it('stops at the real catalog maximum and does not turn one-level exclusive items into upgrade purchases', async () => {
    const t = fixture();
    let row = await buy(t, 'item/hat.cap.1');
    for (let step = 0; step < 2; step++) {
      const target = row.upgrade!.target!.id;
      await t.sdk.execute(upgrade(row.instance!.instanceId, target, `step-${step}`));
      row = (await t.sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
        (value) => value.definition.groupId === 'item/hat.cap',
      )!;
    }
    expect(row.definition.id).toBe('item/hat.cap.3');
    expect(row.upgrade).toMatchObject({ target: null, maxLevel: 3, price: { amount: 0 } });
    expect(
      (await t.sdk.getCharacterInventory({ view: 'upgrades' })).rows.some(
        (row) => row.definition.id === 'item/wings.pixie',
      ),
    ).toBe(false);
    await expect(
      t.sdk.execute({ type: 'buy-cosmetic', offerId: 'item/hat.cap.2', requestId: 'direct', mapInstanceId: 'home' }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  });
});
