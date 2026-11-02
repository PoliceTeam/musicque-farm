import { LUCKY_DRAW_ID } from '@chibi-town/game-content/lucky-draw';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

describe('lucky draw HTTP transactions', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await t.close();
  });
  it.each([
    { random: 0.68, prizeId: 'gems-1', amount: 1 },
    { random: 0.97, prizeId: 'gems-3', amount: 3 },
  ])(
    'persists $prizeId once under concurrent HTTP retries and leaves other accounts unchanged',
    async ({ random, prizeId, amount }) => {
      const a = await t.register('draw_gems_a');
      const b = await t.register('draw_gems_b');
      const sdk = t.sdkFor(a.cookie);
      const before = await sdk.getLuckyDraw();
      const other = await t.sdkFor(b.cookie).getLuckyDraw();
      await sdk.executeLuckyDraw({ type: 'buy-tickets', count: 1, requestId: 'buy-gem-ticket' });
      vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
        if (array instanceof Uint32Array) array.fill(Math.floor(random * 4294967296));
        return array;
      });
      const command = { type: 'spin' as const, drawId: LUCKY_DRAW_ID, requestId: 'gem-roll' };
      const [first, replay] = await Promise.all([sdk.executeLuckyDraw(command), sdk.executeLuckyDraw(command)]);
      expect(first).toEqual(replay);
      expect(first).toMatchObject({
        coins: before.coins - 15_000,
        gems: before.gems + amount,
        tickets: 0,
        result: { prizeId, duplicate: false },
      });
      const reopened = t.sdkFor(a.cookie);
      await reopened.executeLuckyDraw(command);
      const saved = await reopened.getLuckyDraw();
      expect(saved.gems).toBe(before.gems + amount);
      expect(saved.history).toHaveLength(1);
      const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
      expect(row.document.farm.gems).toBe(before.gems + amount);
      expect(await t.sdkFor(b.cookie).getLuckyDraw()).toEqual(other);
    },
  );
  it('requires authentication, takes the account from the session and buys once under concurrency', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/lucky-draw' })).statusCode).toBe(401);
    const a = await t.register('draw_a');
    const b = await t.register('draw_b');
    const sdk = t.sdkFor(a.cookie);
    const initial = await sdk.getLuckyDraw();
    const input = { type: 'buy-tickets' as const, count: 2, requestId: 'buy-two' };
    await Promise.all([sdk.executeLuckyDraw(input), sdk.executeLuckyDraw(input)]);
    expect(await sdk.getLuckyDraw()).toMatchObject({ coins: initial.coins - 30_000, tickets: 2 });
    expect((await t.sdkFor(b.cookie).getLuckyDraw()).tickets).toBe(0);
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
    expect(row.document.characterInventory).toBeUndefined();
    expect(row.document.luckyDraw?.tickets).toBe(2);
    const roll = { type: 'spin' as const, drawId: LUCKY_DRAW_ID, requestId: 'roll' };
    const [first, replay] = await Promise.all([sdk.executeLuckyDraw(roll), sdk.executeLuckyDraw(roll)]);
    expect(first.result).toEqual(replay.result);
    expect((await sdk.getLuckyDraw()).tickets).toBe(first.tickets);
    expect((await sdk.getLuckyDraw()).history).toHaveLength(1);
  });
  it('ignores forged prices and rewards, rejects overspending and direct exclusive-item purchases', async () => {
    const a = await t.register('draw_forgery');
    const sdk = t.sdkFor(a.cookie);
    const before = await sdk.getLuckyDraw();
    const bought = await t.app.inject({
      method: 'POST',
      url: '/api/lucky-draw',
      headers: { cookie: a.cookie },
      payload: {
        type: 'buy-tickets',
        count: 1,
        requestId: 'forged',
        price: 0,
        playerId: 'another',
        reward: 'item/wings.pixie',
      },
    });
    expect(bought.statusCode).toBe(200);
    expect(await sdk.getLuckyDraw()).toMatchObject({ tickets: 1, coins: before.coins - 15_000, ownedCosmetics: [] });
    await expect(
      sdk.executeLuckyDraw({ type: 'buy-tickets', count: 100, requestId: 'overdraw' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
    await expect(
      sdk.execute({ type: 'buy-cosmetic', offerId: 'item/wings.pixie', requestId: 'direct', mapInstanceId: 'home' }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await sdk.getLuckyDraw()).tickets).toBe(1);
  });
});
