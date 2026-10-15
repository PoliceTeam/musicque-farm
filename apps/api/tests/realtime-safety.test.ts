import { once } from 'node:events';
import { Writable } from 'node:stream';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { afterEach, expect, it, vi } from 'vitest';
import { deleteSession } from '@/_utils/session-auth';
import { createApp } from '@/app';
import { createRealtimeHub } from '@/infrastructure/realtime/realtime-hub';
import { createMemorySharedState } from '@/infrastructure/realtime/shared-state';
import { createMapRooms } from '@/modules/world';
import { createTestApp, testConfig } from './test-app.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('logout closes the revoked session on another API instance', async () => {
  const shared = createMemorySharedState();
  const first = await createTestApp({ shared });
  const second = await createApp({ db: first.db, shared, config: testConfig, clock: first.clock, sweepMs: 0 });
  await second.app.ready();
  cleanup.push(first.close, () => second.app.close());
  const { cookie } = await first.register('logout-ws');
  const socket = await second.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => socket.terminate());
  const tab = await first.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => tab.terminate());
  const login = await first.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'logout-ws@example.test', password: 'correct horse' },
  });
  const other = await second.app.injectWS('/api/ws', {
    headers: { cookie: first.cookieOf(login.headers), origin: testConfig.webOrigin },
  });
  cleanup.push(async () => other.terminate());
  const closed = once(socket, 'close', { signal: AbortSignal.timeout(2000) });
  const tabClosed = once(tab, 'close', { signal: AbortSignal.timeout(2000) });
  await first.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
  expect((await closed)[0]).toBe(4001);
  expect((await tabClosed)[0]).toBe(4001);
  expect(other.readyState).toBe(other.OPEN);
});

it('rejects teleport moves and repeated enter in the same map', async () => {
  const shared = createMemorySharedState();
  const hub = createRealtimeHub(shared);
  const rooms = createMapRooms(hub, shared);
  const events: unknown[] = [];
  const client = hub.connect('walker', () => {});
  const observer = hub.connect('observer', (event) => events.push(event));
  hub.subscribe(observer, 'map:street:1');
  const player = { id: 'walker', name: 'Walker', level: 1, outfit: defaultOutfit, x: 0, y: 0 };
  await rooms.enter(client, 'street', 1, [1000, 1000], player);
  events.length = 0;
  await rooms.move(client, 900, 900);
  expect(events).toEqual([]);
  await rooms.enter(client, 'street', 1, [1000, 1000], { ...player, x: 900 });
  expect(events).toEqual([]);
  // A reconnect has a new owner and must be able to replay its latest enter position.
  const reconnected = hub.connect('walker', () => {});
  await rooms.enter(reconnected, 'street', 1, [1000, 1000], { ...player, x: 900 });
  expect(events).toContainEqual({ type: 'map.join', player: { ...player, x: 900 } });
  hub.close();
});

it('bounds a blocked connection queue while another player can still enter a map', async () => {
  const shared = createMemorySharedState();
  const test = await createTestApp({ shared });
  cleanup.push(test.close);
  const a = await test.register('spam-a');
  const b = await test.register('spam-b');
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = shared.set;
  let held = false;
  vi.spyOn(shared, 'set').mockImplementation(async (key, value, ttl) => {
    if (key.startsWith(`connection:${a.player.id}:`)) {
      held = true;
      await blocked;
    }
    await original(key, value, ttl);
  });
  cleanup.push(async () => release());
  const one = await test.app.injectWS('/api/ws', { headers: { cookie: a.cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => one.terminate());
  await vi.waitFor(() => expect(held).toBe(true));
  const server = [...test.app.websocketServer.clients][0];
  const close = vi.spyOn(server, 'close');
  const exclusive = vi.spyOn(shared, 'exclusive');
  for (let i = 0; i < 10_000; i++) server.emit('message', Buffer.from('{"type":"map.leave"}'));
  expect(close).toHaveBeenCalledWith(4008);
  expect(exclusive).not.toHaveBeenCalled();
  const two = await test.app.injectWS('/api/ws', { headers: { cookie: b.cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => two.terminate());
  const state = once(two, 'message', { signal: AbortSignal.timeout(2000) });
  two.send(JSON.stringify({ type: 'map.enter', regionId: 'fun', mapId: 'entertainment-street', x: 10, y: 20 }));
  expect(JSON.parse(String((await state)[0])).type).toBe('map.state');
  release();
});

it('drops all command types at the common limit, with a stricter shared enter/watch limit and no per-message touch', async () => {
  const shared = createMemorySharedState();
  const test = await createTestApp({ shared });
  cleanup.push(test.close);
  const { cookie } = await test.register('rate-ws');
  const socket = await test.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => socket.terminate());
  const server = [...test.app.websocketServer.clients][0];
  const exclusive = vi.spyOn(shared, 'exclusive');
  const get = vi.spyOn(shared, 'get');
  const transactions = vi.spyOn(test.db, 'transaction');
  for (let i = 0; i < 100; i++) {
    server.emit('message', Buffer.from('{"type":"lobby.watch","gameId":"chess"}'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  await vi.waitFor(() => expect(transactions).toHaveBeenCalledTimes(2));
  // Presence.touch reads this key; lobby.watch itself only queries PostgreSQL.
  expect(get.mock.calls.filter(([key]) => key.startsWith('presence:'))).toHaveLength(0);
  expect(exclusive).not.toHaveBeenCalled();
  // The expensive-command bucket is independent of the common budget, which is now exhausted.
  server.emit('message', Buffer.from('{"type":"map.leave"}'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(exclusive).not.toHaveBeenCalled();
});

it.each(['expired', 'revoked'] as const)(
  'heartbeat closes a %s session without waiting for a command',
  async (reason) => {
    const test = await createTestApp();
    cleanup.push(test.close);
    const { cookie } = await test.register(`hb-${reason}`);
    const interval = globalThis.setInterval;
    let tick: (() => void) | undefined;
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((task: () => void, ms: number) => {
      if (ms === 15_000) tick = task;
      return interval(task, ms);
    }) as typeof setInterval);
    const socket = await test.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
    cleanup.push(async () => socket.terminate());
    if (reason === 'expired') test.advance(31 * 86400_000);
    else {
      await deleteSession(test.db, cookie.split('=')[1]);
      test.advance(60_000);
    }
    const closed = once(socket, 'close', { signal: AbortSignal.timeout(2000) });
    tick!();
    expect((await closed)[0]).toBe(4001);
  },
);

it('disconnects a slow receiver before sending more payload', async () => {
  const test = await createTestApp();
  cleanup.push(test.close);
  const { cookie } = await test.register('slow-ws');
  const socket = await test.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => socket.terminate());
  const server = [...test.app.websocketServer.clients][0];
  vi.spyOn(server, 'bufferedAmount', 'get').mockReturnValue(256 * 1024 + 1);
  const send = vi.spyOn(server, 'send');
  const closed = once(socket, 'close', { signal: AbortSignal.timeout(2000) });
  socket.send(JSON.stringify({ type: 'map.enter', regionId: 'fun', mapId: 'entertainment-street', x: 10, y: 20 }));
  expect((await closed)[0]).toBe(4009);
  expect(send).not.toHaveBeenCalled();
});

it('warns in production without Redis and still starts successfully', async () => {
  const logs: { level: number; msg: string }[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logs.push(JSON.parse(String(chunk)));
      callback();
    },
  });
  vi.stubEnv('NODE_ENV', 'production');
  const test = await createTestApp({ logger: { level: 'warn', stream } });
  cleanup.push(test.close);
  await test.app.ready();
  expect(logs).toContainEqual(expect.objectContaining({ level: 40, msg: expect.stringContaining('REDIS_URL') }));
});
