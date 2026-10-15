import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { playerDocuments } from '@/infrastructure/database/schema';
import { withPlayerDocument } from '@/modules/player';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('uses the injected clock for player document writes', async () => {
  const account = await t.register('timestamp');
  await withPlayerDocument(
    t.db,
    account.player.id,
    (document) => {
      document.revision++;
    },
    undefined,
    t.clock,
  );
  const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, account.player.id));
  expect(row.updatedAt.getTime()).toBe(t.clock());
});
