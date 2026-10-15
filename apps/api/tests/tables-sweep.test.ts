import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { arcadeTables } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('isolates and logs a failed stale table while sweeping other tables', async () => {
  const one = await t.register('broken');
  const two = await t.register('healthy');
  await t.sdkFor(one.cookie).startTienRoom({ roomId: 0, tableId: 6, requestId: 'bad' });
  await t.sdkFor(two.cookie).startTienRoom({ roomId: 0, tableId: 7, requestId: 'good' });
  const [bad] = await t.db.select().from(arcadeTables).where(eq(arcadeTables.tableId, 6));
  await t.db.execute(sql`create function reject_broken_delete() returns trigger language plpgsql as $$
    begin
      if old.table_id = 6 then raise exception 'injected table failure'; end if;
      return old;
    end $$`);
  await t.db.execute(
    sql`create trigger broken_table before delete on arcade_tables for each row execute function reject_broken_delete()`,
  );
  const logged = vi.spyOn(t.app.log, 'error');
  t.advance(16 * 60_000);
  await t.tables.sweep();
  expect(await t.db.select().from(arcadeTables).where(eq(arcadeTables.tableId, 7))).toHaveLength(0);
  expect(await t.db.select().from(arcadeTables).where(eq(arcadeTables.id, bad.id))).toHaveLength(1);
  expect(logged).toHaveBeenCalledWith(
    expect.objectContaining({ tableId: bad.id, err: expect.anything() }),
    expect.any(String),
  );
  logged.mockClear();
  await t.tables.releaseWaiting(one.player.id);
  expect(logged).toHaveBeenCalledWith(
    expect.objectContaining({ tableId: bad.id, err: expect.anything() }),
    expect.any(String),
  );
  logged.mockRestore();
  await t.db.execute(sql`drop trigger broken_table on arcade_tables`);
  await t.db.execute(sql`drop function reject_broken_delete()`);
});
