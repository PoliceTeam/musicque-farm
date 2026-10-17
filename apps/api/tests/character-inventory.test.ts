import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  characterInstances,
  characterInventories,
  characterUnlocks,
  playerDocuments,
} from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

describe('server character inventory transactions', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  async function fund(playerId: string) {
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, playerId));
    row.document.farm.coins = 500_000;
    await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, playerId));
  }

  it('serves store-specific inventory and enforces Premium prices and upgrade-only levels on HTTP commands', async () => {
    const account = await t.register('salon_buyer');
    await fund(account.player.id);
    const sdk = t.sdkFor(account.cookie);
    const normal = await sdk.getCharacterInventory({ view: 'shop', shop: 'salon', slot: 'hair', limit: 50 });
    expect(normal.rows.length).toBeGreaterThan(0);
    expect(normal.rows.every((row) => row.offer?.shop === 'salon')).toBe(true);
    expect(normal.rows.some((row) => row.definition.groupId === 'item/hair.goku')).toBe(false);
    const premium = await sdk.getCharacterInventory({ view: 'shop', shop: 'premium', groupId: 'item/hair.goku' });
    expect(premium.rows.every((row) => !('level' in row.definition) || row.definition.level === 1)).toBe(true);
    const forgedPrice = await t.app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie: account.cookie },
      payload: {
        type: 'buy-cosmetic',
        offerId: 'item/hair.goku.1',
        price: 1,
        requestId: 'premium-lowest',
        mapInstanceId: 'home',
      },
    });
    expect(forgedPrice.statusCode).toBe(200);
    expect((await sdk.getInventory()).farm.coins).toBe(300_000);
    await expect(
      sdk.execute({
        type: 'buy-cosmetic',
        offerId: 'item/hair.goku.2',
        requestId: 'upgrade-direct',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await sdk.getInventory()).farm.coins).toBe(300_000);
    expect((await sdk.getCharacterInventory({ view: 'bag' })).rows.map((row) => row.definition.id)).toEqual([
      'item/hair.goku.1',
    ]);
  });

  it('migrates to normalized tables, scopes data by session and never adds inventory to farm snapshots', async () => {
    const a = await t.register('owner_a');
    const b = await t.register('owner_b');
    const sdk = t.sdkFor(a.cookie);
    const first = await sdk.getCharacterInventory({ view: 'equipped' });
    expect(first.rows.length).toBeGreaterThan(0);
    expect(first.bagUsed).toBe(0);
    await sdk.execute({ type: 'buy-cosmetic', offerId: 'pet/cat', requestId: 'a-cat', mapInstanceId: 'home' });
    expect((await sdk.getCharacterInventory({ view: 'bag' })).rows).toHaveLength(1);
    expect((await t.sdkFor(b.cookie).getCharacterInventory({ view: 'bag' })).rows).toHaveLength(0);
    const ownedA = await sdk.getCharacterInventory({ view: 'owned', limit: 50 });
    const ownedB = await t.sdkFor(b.cookie).getCharacterInventory({ view: 'owned', limit: 50 });
    expect(ownedA.rows.some((row) => row.definition.id === 'pet/cat')).toBe(true);
    expect(ownedB.rows.some((row) => row.definition.id === 'pet/cat')).toBe(false);
    expect(ownedA.rows.every((row) => row.owned)).toBe(true);
    const basketA = await sdk.getCharacterInventory({ view: 'unequipped', limit: 50 });
    expect(basketA.rows.some((row) => row.definition.id === 'pet/cat')).toBe(true);
    expect(basketA.rows.every((row) => row.owned && row.instance?.location.container !== 'equipped')).toBe(true);
    expect((await t.sdkFor(b.cookie).getCharacterInventory({ view: 'unequipped' })).total).toBe(0);

    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    expect(row.document.characterInventory).toBeUndefined();
    expect((await sdk.getInventory()) as unknown as Record<string, unknown>).not.toHaveProperty('characterInventory');
    expect(
      await t.db.select().from(characterUnlocks).where(eq(characterUnlocks.playerId, a.player.id)),
    ).not.toHaveLength(0);
  });

  it('serializes duplicate purchases, persists each grant once and makes colors permanent across reads', async () => {
    const account = await t.register('buyer');
    await fund(account.player.id);
    const sdk = t.sdkFor(account.cookie);
    const command = { type: 'buy-cosmetic', offerId: 'pet/cat', requestId: 'buy-cat', mapInstanceId: 'home' } as const;
    const bought = await Promise.all([sdk.execute(command), sdk.execute(command)]);
    expect(bought[0]).toEqual(bought[1]);
    expect((await sdk.getInventory()).farm.coins).toBe(420000);
    await expect(sdk.execute({ ...command, requestId: 'buy-again' })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await sdk.execute({
      type: 'buy-cosmetic',
      offerId: 'item-color/shirt.tank/red',
      requestId: 'red',
      mapInstanceId: 'home',
    });
    for (const requestId of ['wear-red', 'wear-red-again'])
      await sdk.execute({
        type: 'apply-cosmetic-color',
        cosmeticId: 'item-color/shirt.tank/red',
        requestId,
        mapInstanceId: 'home',
      });
    expect((await sdk.getInventory()).farm.coins).toBe(408000);
    expect((await sdk.getPlayer()).outfit.shirtColor).toBe('Đỏ');
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, account.player.id));
    expect(row.document.characterInventory).toBeUndefined();
    // Wallet reservation failure occurs after the domain operation; SQL must roll back grants too.
    row.document.tableStakes = { diamonds: row.document.farm.coins };
    await t.db
      .update(playerDocuments)
      .set({ document: row.document })
      .where(eq(playerDocuments.playerId, account.player.id));
    await expect(
      sdk.execute({ type: 'buy-cosmetic', offerId: 'pet/corgi', requestId: 'reserved-money', mapInstanceId: 'home' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
    expect((await sdk.getInventory()).farm.coins).toBe(408000);
    const corgi = await sdk.getCharacterInventory({ view: 'shop', groupId: 'pet/corgi' });
    expect(corgi.rows.every((item) => !item.owned)).toBe(true);
    const instances = await t.db
      .select()
      .from(characterInstances)
      .where(eq(characterInstances.playerId, account.player.id));
    expect(instances.filter((item) => item.data.cosmeticId === 'pet/cat')).toHaveLength(1);
    expect(instances.find((item) => item.data.cosmeticId === 'item/shirt.tank')?.data.colorUnlockId).toBe(
      'item-color/shirt.tank/red',
    );
  });

  it('moves and swaps with unique slots while a failed operation rolls back every row and the wallet', async () => {
    const account = await t.register('swapper');
    await fund(account.player.id);
    const sdk = t.sdkFor(account.cookie);
    for (const pet of ['cat', 'corgi'])
      await sdk.execute({ type: 'buy-cosmetic', offerId: `pet/${pet}`, requestId: pet, mapInstanceId: 'home' });
    const bag = await sdk.getCharacterInventory({ view: 'bag' });
    const cat = bag.rows.find((row) => row.definition.id === 'pet/cat')!.instance!;
    const corgi = bag.rows.find((row) => row.definition.id === 'pet/corgi')!.instance!;
    await t.db
      .update(characterInventories)
      .set({ bagSlots: 2 })
      .where(eq(characterInventories.playerId, account.player.id));
    await sdk.execute({
      type: 'equip-character-item',
      instanceId: cat.instanceId,
      requestId: 'wear-cat',
      mapInstanceId: 'home',
    });
    await sdk.execute({ type: 'buy-cosmetic', offerId: 'pet/bunny', requestId: 'fill-bag', mapInstanceId: 'home' });
    await expect(
      sdk.execute({
        type: 'unequip-character-item',
        instanceId: cat.instanceId,
        requestId: 'full',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'INVENTORY_FULL' });
    await sdk.execute({
      type: 'equip-character-item',
      instanceId: corgi.instanceId,
      requestId: 'wear-corgi',
      mapInstanceId: 'home',
    });
    expect((await sdk.getPlayer()).outfit.pet).toBe('corgi');
    const final = await sdk.getCharacterInventory({ view: 'bag' });
    expect(final.rows.some((row) => row.definition.id === 'pet/cat')).toBe(true);
    const [row] = await t.db
      .select()
      .from(characterInstances)
      .where(
        and(eq(characterInstances.playerId, account.player.id), eq(characterInstances.instanceId, cat.instanceId)),
      );
    expect(row.container).toBe('bag');
    expect(row.bagSlot).toBe(1);
  });

  it('rejects unowned equip/color and arbitrary client grants without granting new ownership', async () => {
    const account = await t.register('protected');
    const sdk = t.sdkFor(account.cookie);
    const before = await sdk.getPlayer();
    await expect(
      sdk.execute({
        type: 'equip-outfit',
        outfit: { ...before.outfit, pet: 'cat', petLevel: '3' },
        requestId: 'forged',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await expect(
      sdk.execute({
        type: 'apply-cosmetic-color',
        cosmeticId: 'item-color/shirt.tank/red',
        requestId: 'forged-color',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie: account.cookie },
      payload: { type: 'grant-cosmetics', cosmeticIds: ['pet/cat.3'], requestId: 'fake-quest', mapInstanceId: 'home' },
    });
    expect(response.statusCode).toBe(400);
    expect((await sdk.getPlayer()).outfit).toEqual(before.outfit);
  });
});
