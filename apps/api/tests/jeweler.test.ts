import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(() => t.close());
it('authenticates jeweler trades and serializes holdings, wallet and receipts per owner', async () => {
  const a = await t.register('gem_owner');
  const b = await t.register('gem_other');
  const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
  row.document.farm.coins = 100000;
  await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, a.player.id));
  expect((await t.app.inject({ method: 'GET', url: '/api/jeweler' })).statusCode).toBe(401);
  const sdk = t.sdkFor(a.cookie);
  const input = { type: 'buy' as const, materialId: 'blue' as const, count: 6, requestId: 'buy-once' };
  expect((await t.app.inject({ method: 'POST', url: '/api/jeweler', payload: input })).statusCode).toBe(401);
  const [first, replay] = await Promise.all([sdk.executeJeweler(input), sdk.executeJeweler(input)]);
  expect(first).toEqual(replay);
  expect(first.coins).toBe(70000);
  expect(first.materials.blue).toBe(6);
  const fused = await sdk.executeJeweler({ type: 'fuse', materialId: 'green', count: 2, requestId: 'fuse' });
  expect(fused.materials).toMatchObject({ blue: 0, green: 2 });
  expect(fused.coins).toBe(70000);
  const [sale, repeat] = await Promise.all([
    sdk.executeJeweler({ type: 'sell', materialId: 'green', count: 2, requestId: 'sell' }),
    sdk.executeJeweler({ type: 'sell', materialId: 'green', count: 2, requestId: 'sell' }),
  ]);
  expect(sale).toEqual(repeat);
  expect(sale.coins).toBe(96000);
  expect(sale.materials.green).toBe(0);
  expect(Object.values((await t.sdkFor(b.cookie).getJeweler()).materials)).toEqual(Array(8).fill(0));
  await expect(
    t.sdkFor(b.cookie).executeJeweler({ type: 'sell', materialId: 'green', count: 1, requestId: 'foreign' }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  expect((await sdk.getJeweler()).coins).toBe(96000);
  await sdk.executeJeweler({ type: 'buy', materialId: 'blue', count: 1, requestId: 'one-stone' });
  const race = await Promise.allSettled(
    ['sale-a', 'sale-b'].map((requestId) =>
      sdk.executeJeweler({ type: 'sell', materialId: 'blue', count: 1, requestId }),
    ),
  );
  expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(race.filter((result) => result.status === 'rejected')).toHaveLength(1);
  expect((await sdk.getJeweler()).coins).toBe(94000);
  expect((await sdk.getJeweler()).materials.blue).toBe(0);
});
