import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('only allows one concurrent practice/PvP start', async () => {
  const { cookie } = await t.register('racer');
  const sdk = t.sdkFor(cookie);
  const outcomes = await Promise.allSettled([
    sdk.startTienRoom({ roomId: 0, tableId: 2, requestId: 'pvp' }),
    sdk.startTienRoom({ roomId: 3, tableId: 2, requestId: 'practice' }),
  ]);
  expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find((result) => result.status === 'rejected')).toMatchObject({
    reason: { code: 'MATCH_IN_PROGRESS' },
  });
});
