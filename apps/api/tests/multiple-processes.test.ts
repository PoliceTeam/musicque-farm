import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import { type Database, openDatabase } from '@/infrastructure/database/database';
import { createMemorySharedState, createRedisSharedState } from '@/infrastructure/realtime/shared-state';
import { createTestApp, testConfig } from './test-app.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
});

async function pair() {
  const shared = createMemorySharedState();
  const first = await createTestApp({ shared });
  const second = await createApp({ db: first.db, shared, config: testConfig, clock: first.clock, sweepMs: 0 });
  await second.app.ready();
  cleanup.push(first.close, () => second.app.close());
  return { first, second, shared };
}

function next(socket: Awaited<ReturnType<Awaited<ReturnType<typeof createApp>>['app']['injectWS']>>, type: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', listen);
      reject(new Error(`Missing ${type}`));
    }, 2000);

    function listen(data: unknown) {
      const event = JSON.parse(String(data));
      if (event.type !== type) return;
      clearTimeout(timer);
      socket.off('message', listen);
      resolve(event);
    }

    socket.on('message', listen);
  });
}

describe('two API processes sharing coordination and PostgreSQL', () => {
  it('fans table events from A out to a socket on B without leaking snapshots', async () => {
    const { first, second } = await pair();
    const { cookie } = await first.register('cross-table');
    const socket = await second.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
    const changed = next(socket, 'match');
    await first.sdkFor(cookie).startTienRoom({ roomId: 0, requestId: 'cross-start' });
    expect(await changed).toEqual({ type: 'match', gameId: 'tien-len' });
    socket.terminate();
  });

  it('shares map-room state and movements across processes', async () => {
    const { first, second } = await pair();
    const a = await first.register('cross-map-a'),
      b = await first.register('cross-map-b');
    const one = await first.app.injectWS('/api/ws', { headers: { cookie: a.cookie, origin: testConfig.webOrigin } });
    const two = await second.app.injectWS('/api/ws', { headers: { cookie: b.cookie, origin: testConfig.webOrigin } });
    const enter = { type: 'map.enter', regionId: 'fun', mapId: 'entertainment-street', x: 10, y: 20 };
    let state = next(one, 'map.state');
    one.send(JSON.stringify(enter));
    await state;
    state = next(two, 'map.state');
    const joined = next(one, 'map.join');
    two.send(JSON.stringify(enter));
    expect((await state).players).toMatchObject([{ id: a.player.id }]);
    expect((await joined).player).toMatchObject({ id: b.player.id });
    const moved = next(one, 'map.move');
    two.send(JSON.stringify({ type: 'map.move', x: 25, y: 30 }));
    expect(await moved).toMatchObject({ id: b.player.id, x: 25, y: 30 });
    one.terminate();
    two.terminate();
  });

  it('keeps channel capacity atomic across both instances', async () => {
    const { first, second } = await pair();
    const players = await Promise.all(Array.from({ length: 31 }, (_, i) => first.register(`cross-crowd-${i}`)));
    const results = await Promise.all(
      players.map(({ cookie }, index) =>
        (index % 2 ? first.app : second.app).inject({
          method: 'POST',
          url: '/api/maps/channels/join',
          headers: { cookie },
          payload: { regionId: 'fun', mapId: 'entertainment-street', channelId: 9 },
        }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(30);
    expect(results.filter((r) => r.json().code === 'CHANNEL_FULL')).toHaveLength(1);
  });

  it('shares failed sign-in attempts', async () => {
    const { first, second } = await pair();
    await first.register('cross-login');
    for (let i = 0; i < 10; i++) {
      const result = await (i % 2 ? first.app : second.app).inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'cross-login@example.test', password: 'wrong password' },
      });
      expect(result.statusCode).toBe(401);
    }
    expect(
      (
        await second.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'cross-login@example.test', password: 'correct horse' },
        })
      ).statusCode,
    ).toBe(429);
  });

  it('runs at most one sweep transaction at a time', async () => {
    const database = await openDatabase('pglite:memory');
    let active = 0,
      maximum = 0,
      acquisitions = 0;
    const observed = new Proxy(database.db, {
      get(target, property) {
        if (property !== 'transaction') return Reflect.get(target, property);
        return (callback: Parameters<Database['transaction']>[0]) =>
          target.transaction(async (tx) => {
            let acquired = false;
            const wrapped = new Proxy(tx, {
              get(transaction, key) {
                if (key !== 'execute') return Reflect.get(transaction, key);
                return async (query: Parameters<typeof tx.execute>[0]) => {
                  const result = await transaction.execute(query);
                  if ((result as unknown as { rows?: { acquired?: boolean }[] }).rows?.[0]?.acquired) {
                    acquired = true;
                    acquisitions++;
                    active++;
                    maximum = Math.max(maximum, active);
                    await new Promise((resolve) => setTimeout(resolve, 20));
                  }
                  return result;
                };
              },
            });
            try {
              return await callback(wrapped);
            } finally {
              if (acquired) active--;
            }
          });
      },
    });
    const shared = createMemorySharedState();
    const first = await createTestApp({ shared, database: { db: observed, close: database.close } });
    const second = await createApp({ db: observed, config: testConfig, shared, sweepMs: 0 });
    cleanup.push(first.close, () => second.app.close());
    await Promise.all([first.tables.sweep(), second.tables.sweep()]);
    expect(acquisitions).toBeGreaterThan(0);
    expect(maximum).toBe(1);
    // The database, rather than the process-local bus, provides the lock.
    const lock = await first.db.execute(sql`select pg_try_advisory_lock(76324891) as acquired`);
    expect((lock as unknown as { rows: { acquired: boolean }[] }).rows[0].acquired).toBe(true);
    await first.db.execute(sql`select pg_advisory_unlock(76324891)`);
  });
});

it.skipIf(!process.env.REDIS_URL)('Redis adapters fan out and atomically reserve the last channel place', async () => {
  const prefix = `chibi-test:${crypto.randomUUID()}:`;
  const a = await createRedisSharedState(process.env.REDIS_URL!, prefix);
  const b = await createRedisSharedState(process.env.REDIS_URL!, prefix);
  cleanup.push(
    () => a.close(),
    () => b.close(),
  );
  const received = new Promise<string>((resolve) => b.subscribe(resolve));
  await a.publish('across-redis');
  expect(await received).toBe('across-redis');
  const accepted = await Promise.all([
    a.claimPresence('a', 'street', 1, 1, Date.now(), 1000),
    b.claimPresence('b', 'street', 1, 1, Date.now(), 1000),
  ]);
  expect(accepted.filter(Boolean)).toHaveLength(1);
});
