import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { createMemoryAdapters } from '@chibi-town/realtime-core';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { characterGrants, playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

describe('cosmetic upgrade HTTP transactions', () => {
  let adapters: ReturnType<typeof createMemoryAdapters>;

  async function nearJeweler(id: string) {
    await adapters.store.claim(
      'map:shopping-street:0',
      id,
      { owner: id, player: { player: { id, name: id, level: 1, outfit: defaultOutfit, x: 1670, y: 580 } } },
      100,
      t.clock(),
      t.clock() + 60_000,
    );
  }

  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint32Array) array.fill(0);
      return array;
    });
    adapters = createMemoryAdapters();
    t = await createTestApp({ adapters });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await t.close();
  });
  it('serializes upgrades with wallet and inventory, replays once, persists the grant and isolates owners', async () => {
    const a = await t.register('upgrade_owner');
    const b = await t.register('upgrade_other');
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    row.document.farm.coins = 1_000_000;
    row.document.jeweler = { materials: { blue: 10 }, receipts: {} };
    await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, a.player.id));
    const sdk = t.sdkFor(a.cookie);
    await nearJeweler(a.player.id);
    await nearJeweler(b.player.id);
    await sdk.execute({ type: 'buy-cosmetic', offerId: 'item/hat.cap.1', requestId: 'buy', mapInstanceId: 'home' });
    const cap = (await sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
      (row) => row.definition.id === 'item/hat.cap.1',
    )!;
    const input = {
      type: 'upgrade-character-item' as const,
      instanceId: cap.instance!.instanceId,
      targetId: 'item/hat.cap.2',
      requestId: 'upgrade-once',
      currency: 'coins' as const,
      recipeVersion: 1,
      mapInstanceId: 'home',
    };
    expect((await t.app.inject({ method: 'POST', url: '/api/commands', payload: input })).statusCode).toBe(401);
    await expect(t.sdkFor(b.cookie).execute(input)).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    const [first, replay] = await Promise.all([sdk.execute(input), sdk.execute(input)]);
    expect(first).toEqual(replay);
    expect(first.farm.coins).toBe(935_000);
    await expect(sdk.execute({ ...input, requestId: 'same-target-new-request' })).rejects.toMatchObject({
      code: 'NOT_ALLOWED',
    });
    const upgraded = await sdk.getCharacterInventory({ view: 'owned', groupId: 'item/hat.cap' });
    expect(upgraded.rows.filter((row) => row.instance)).toHaveLength(2);
    const grants = await t.db.select().from(characterGrants).where(eq(characterGrants.playerId, a.player.id));
    expect(grants.filter((row) => row.data.source.kind === 'upgrade')).toHaveLength(1);
    const [saved] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    expect(saved.document.characterInventory).toBeUndefined();
  });
  it('rejects remote calls, persists failed rolls atomically and guarantees the fifth attempt across fee changes', async () => {
    const a = await t.register('upgrade_failure');
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    row.document.farm.coins = 5_000_000;
    row.document.farm.gems = 1000;
    row.document.jeweler = { materials: { blue: 10, green: 10 }, receipts: {} };
    await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, a.player.id));
    const sdk = t.sdkFor(a.cookie);
    await sdk.execute({ type: 'buy-cosmetic', offerId: 'item/hat.cap.1', requestId: 'buy', mapInstanceId: 'home' });
    let cap = (await sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
      (row) => row.definition.groupId === 'item/hat.cap',
    )!;
    const initial = {
      type: 'upgrade-character-item' as const,
      instanceId: cap.instance!.instanceId,
      targetId: 'item/hat.cap.2',
      requestId: 'level2',
      currency: 'coins' as const,
      recipeVersion: 1,
      mapInstanceId: 'home',
    };
    await expect(sdk.execute(initial)).rejects.toMatchObject({ code: 'NOT_NEAR_JEWELER' });
    expect((await sdk.getJeweler()).materials.blue).toBe(10);
    await nearJeweler(a.player.id);
    await sdk.execute(initial);
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint32Array) array.fill(0xffffffff);
      return array;
    });
    cap = (await sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
      (row) => row.definition.groupId === 'item/hat.cap',
    )!;
    const input = {
      ...initial,
      instanceId: cap.instance!.instanceId,
      targetId: 'item/hat.cap.3',
      requestId: 'failure',
    };
    const [first, replay] = await Promise.all([sdk.execute(input), sdk.execute(input)]);
    expect(first.upgrade).toMatchObject({ success: false, failuresAfter: 1 });
    expect(replay.upgrade).toEqual(first.upgrade);
    expect((await sdk.getJeweler()).materials.green).toBe(9);
    await adapters.store.remove('map:shopping-street:0', a.player.id, a.player.id);
    expect((await sdk.execute(input)).upgrade).toEqual(first.upgrade);
    await expect(sdk.execute({ ...input, requestId: 'remote' })).rejects.toMatchObject({ code: 'NOT_NEAR_JEWELER' });
    await nearJeweler(a.player.id);
    for (let n = 2; n <= 5; n++) {
      const result = await sdk.execute({ ...input, requestId: `attempt-${n}`, currency: n % 2 ? 'gems' : 'coins' });
      expect(result.upgrade).toMatchObject({ success: n === 5, guaranteed: n === 5, failuresBefore: n - 1 });
    }
    const holdings = await sdk.getJeweler();
    expect(holdings.materials).toMatchObject({ blue: 9, green: 5 });
    expect(holdings.gems).toBe(952);
    expect(holdings.coins).toBe(4_755_000);
    const grants = await t.db.select().from(characterGrants).where(eq(characterGrants.playerId, a.player.id));
    expect(grants.filter((row) => row.data.source.kind === 'upgrade')).toHaveLength(2);
  });
});
