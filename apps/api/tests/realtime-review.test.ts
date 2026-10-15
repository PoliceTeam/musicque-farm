import { once } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemorySharedState } from '@/infrastructure/realtime/shared-state';
import { createTestApp, testConfig } from './test-app.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
  vi.restoreAllMocks();
});

async function connection() {
  const shared = createMemorySharedState();
  const test = await createTestApp({ shared });
  cleanup.push(test.close);
  const { cookie, player } = await test.register('review-ws');
  const interval = globalThis.setInterval;
  let tick!: () => void;
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((task: () => void, ms: number) => {
    if (ms === 15_000) tick = task;
    return interval(task, ms);
  }) as typeof setInterval);
  const socket = await test.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => socket.terminate());
  const server = [...test.app.websocketServer.clients][0];
  await vi.waitFor(async () => expect(await shared.entries(`connection:${player.id}:`)).toHaveLength(1));
  return {
    test,
    shared,
    socket,
    server,
    player,

    heartbeat(ms = 15_000) {
      test.advance(ms);
      server.emit('pong');
      tick();
    },
  };
}

it.each(['redis', 'database'] as const)(
  'keeps the socket open after one transient %s heartbeat failure and retries',
  async (source) => {
    const { test, shared, socket, server, heartbeat } = await connection();
    const close = vi.spyOn(server, 'close');
    const set = vi.spyOn(shared, 'set');
    const get = vi.spyOn(shared, 'get');
    if (source === 'redis') set.mockRejectedValueOnce(new Error('temporary Redis failure'));
    else
      vi.spyOn(test.db, 'select').mockImplementationOnce(() => {
        throw new Error('temporary DB failure');
      });
    heartbeat(source === 'database' ? 60_000 : 15_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(close).not.toHaveBeenCalled();
    expect(socket.readyState).toBe(socket.OPEN);
    heartbeat();
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/^presence:/)));
    expect(close).not.toHaveBeenCalled();
  },
);

it('only reads session once every four heartbeats and never writes player lastSeenAt', async () => {
  const { test, shared, heartbeat } = await connection();
  const select = vi.spyOn(test.db, 'select');
  const update = vi.spyOn(test.db, 'update');
  const get = vi.spyOn(shared, 'get');
  for (let i = 1; i <= 4; i++) {
    heartbeat();
    await vi.waitFor(() => expect(get.mock.calls.filter(([key]) => key.startsWith('presence:'))).toHaveLength(i));
    expect(select).toHaveBeenCalledTimes(i < 4 ? 0 : 1);
  }
  expect(update).not.toHaveBeenCalled();
});

it('closes at the handshake expiry without querying the database', async () => {
  const { test, socket, heartbeat } = await connection();
  const select = vi.spyOn(test.db, 'select');
  const closed = once(socket, 'close', { signal: AbortSignal.timeout(2000) });
  heartbeat(31 * 86400_000);
  expect((await closed)[0]).toBe(4001);
  expect(select).not.toHaveBeenCalled();
});

it('coalesces 100 moves behind a slow enter lock and applies only the last position after enter', async () => {
  const { test, shared, socket, server, player } = await connection();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  cleanup.push(async () => release());
  const exclusive = shared.exclusive;
  let held = false;
  vi.spyOn(shared, 'exclusive').mockImplementation(async (key, task) => {
    if (key === 'map-rooms' && !held) {
      held = true;
      await blocked;
    }
    return exclusive(key, task);
  });
  const close = vi.spyOn(server, 'close');
  const set = vi.spyOn(shared, 'set');
  server.emit(
    'message',
    Buffer.from(JSON.stringify({ type: 'map.enter', regionId: 'fun', mapId: 'entertainment-street', x: 10, y: 20 })),
  );
  await vi.waitFor(() => expect(held).toBe(true));
  for (let i = 1; i <= 100; i++) {
    test.advance(80);
    server.emit('message', Buffer.from(JSON.stringify({ type: 'map.move', x: 10 + i / 10, y: 20 })));
  }
  expect(close).not.toHaveBeenCalled();
  release();
  await vi.waitFor(() => {
    const writes = set.mock.calls.filter(([key]) => key.startsWith('room:map:') && key.endsWith(`:${player.id}`));
    expect(writes.map(([, entry]) => (entry as { player: { x: number } }).player.x)).toEqual([10, 20]);
  });
  expect(socket.readyState).toBe(socket.OPEN);
});
