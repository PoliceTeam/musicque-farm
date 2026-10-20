import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { characterGrants, playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

describe('cosmetic upgrade HTTP transactions', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());
  it('serializes upgrades with wallet and inventory, replays once, persists the grant and isolates owners', async () => {
    const a = await t.register('upgrade_owner');
    const b = await t.register('upgrade_other');
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    row.document.farm.coins = 1_000_000;
    await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, a.player.id));
    const sdk = t.sdkFor(a.cookie);
    await sdk.execute({ type: 'buy-cosmetic', offerId: 'item/hat.cap.1', requestId: 'buy', mapInstanceId: 'home' });
    const cap = (await sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
      (row) => row.definition.id === 'item/hat.cap.1',
    )!;
    const input = {
      type: 'upgrade-character-item' as const,
      instanceId: cap.instance!.instanceId,
      targetId: 'item/hat.cap.2',
      requestId: 'upgrade-once',
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
});
