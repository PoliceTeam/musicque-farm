import { createTienMatch, playTienSeatAction } from '@chibi-town/arcade-games/tien-len-logic';
import { createPlayerDocument, tableGames } from '@chibi-town/game-service';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { arcadeTables, playerDocuments } from '@/infrastructure/database/schema';
import { signInWithProvider } from '@/modules/auth/service';
import { withPlayerDocument } from '@/modules/player';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('replaces unverified password access and revokes all sessions when Google claims the email', async () => {
  const old = await t.register('claimed');
  const linked = await signInWithProvider(
    t.db,
    {
      provider: 'google',
      subject: 'verified-owner',
      email: 'claimed@example.test',
      emailVerified: true,
      name: 'Owner',
    },
    undefined,
    t.clock(),
  );
  expect(linked.id).toBe(old.player.id);
  const login = await t.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'claimed@example.test', password: 'correct horse' },
  });
  expect(login.statusCode).toBe(401);
  const session = await t.app.inject({ url: '/api/auth/session', headers: { cookie: old.cookie } });
  expect(session.json().player).toBeNull();
});

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

it('stores 128-bit entropy and refreshes it before dealing', async () => {
  const host = await t.register('entropy');
  const sdk = t.sdkFor(host.cookie);
  const match = await sdk.startTienRoom({ roomId: 3, requestId: 'entropy' });

  const read = async () =>
    (await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, host.player.id)))[0].document.tien!
      .activeMatch!.seed;

  const waiting = await read();
  expect(Array.isArray(waiting) && waiting.length).toBe(4);
  await sdk.configureArcadeTable({
    gameId: 'tien-len',
    matchId: match.id,
    revision: match.revision,
    requestId: 'config',
    stake: 0,
    difficulty: 'medium',
  });
  const ready = (await sdk.getTienLobby()).activeMatch!;
  await sdk.playTien({ matchId: ready.id, revision: ready.revision, requestId: 'deal', action: { type: 'start' } });
  expect(await read()).not.toEqual(waiting);
});

it('keeps seeded engines deterministic and accepts legacy numeric saves', () => {
  const match = createTienMatch('same', 0, 42);
  expect(playTienSeatAction(match, 0, { type: 'start' })).toEqual(playTienSeatAction(match, 0, { type: 'start' }));
});

it('records diamond wins', () => {
  const document = createPlayerDocument();
  tableGames.diamonds!.recordWin(document);
  expect(document.arcade).toMatchObject({ wins: 1 });
});

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

it('limits concurrent failed logins inside the same lock', async () => {
  await t.register('ratetest');
  const responses = await Promise.all(
    Array.from({ length: 12 }, () =>
      t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '192.0.2.222',
        payload: { email: 'ratetest@example.test', password: 'wrong password' },
      }),
    ),
  );
  expect(responses.filter((response) => response.statusCode === 401)).toHaveLength(10);
  expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(2);
});
