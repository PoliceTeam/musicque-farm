import { once } from 'node:events';
import { Writable } from 'node:stream';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { createMemoryAdapters } from '@chibi-town/realtime-core';
import { afterEach, expect, it, vi } from 'vitest';
import { deleteSession } from '@/_utils/session-auth';
import { createApp } from '@/app';
import { createMapRooms } from '@/modules/world';
import { createRealtimeDriver } from './realtime-test-driver.js';
import { createTestApp, testConfig } from './test-app.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('logout closes the revoked session on another API instance', async () => {
  const shared = createMemoryAdapters();
  const first = await createTestApp({ adapters: shared });
  const second = await createApp({
    db: first.db,
    adapters: shared,
    config: testConfig,
    clock: first.clock,
    sweepMs: 0,
  });
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
  const shared = createMemoryAdapters();
  const hub = createRealtimeDriver(shared);
  const rooms = createMapRooms(hub.realtime);
  const events: unknown[] = [];
  const client = hub.connect('walker', () => {});
  const observer = hub.connect('observer', (event) => events.push(event));
  await hub.realtime.subscribe(observer, 'map:street:1');
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
  await hub.realtime.close();
});

it('bounds a blocked connection queue while another player can still enter a map', async () => {
  const shared = createMemoryAdapters();
  const test = await createTestApp({ adapters: shared });
  cleanup.push(test.close);
  const a = await test.register('spam-a');
  const b = await test.register('spam-b');
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = shared.store.lease;
  let held = false;
  vi.spyOn(shared.store, 'lease').mockImplementation(async (key, owner, until) => {
    if (key === a.player.id) {
      held = true;
      await blocked;
    }
    await original(key, owner, until);
  });
  cleanup.push(async () => release());
  const one = await test.app.injectWS('/api/ws', { headers: { cookie: a.cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => one.terminate());
  await vi.waitFor(() => expect(held).toBe(true));
  const server = [...test.app.websocketServer.clients][0];
  const close = vi.spyOn(server, 'close');
  const exclusive = vi.spyOn(shared.coordination, 'exclusive');
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
  const shared = createMemoryAdapters();
  const test = await createTestApp({ adapters: shared });
  cleanup.push(test.close);
  const { cookie } = await test.register('rate-ws');
  const socket = await test.app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
  cleanup.push(async () => socket.terminate());
  const server = [...test.app.websocketServer.clients][0];
  const exclusive = vi.spyOn(shared.coordination, 'exclusive');
  const get = vi.spyOn(shared.store, 'touch');
  const transactions = vi.spyOn(test.db, 'transaction');
  for (let i = 0; i < 100; i++) {
    server.emit('message', Buffer.from('{"type":"lobby.watch","gameId":"chess"}'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  await vi.waitFor(() => expect(transactions).toHaveBeenCalledTimes(2));
  // Presence.touch reads this key; lobby.watch itself only queries PostgreSQL.
  expect(get).not.toHaveBeenCalled();
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

it('updates a move without a coordination lock or room enumeration', async () => {
  const adapters = createMemoryAdapters();
  const driver = createRealtimeDriver(adapters);
  const rooms = createMapRooms(driver.realtime);
  const client = driver.connect('walker', () => {});
  await rooms.enter(client, 'street', 1, [100, 100], {
    id: 'walker',
    name: 'Walker',
    level: 1,
    outfit: defaultOutfit,
    x: 0,
    y: 0,
  });
  const lock = vi.spyOn(adapters.coordination, 'exclusive');
  const members = vi.spyOn(adapters.store, 'members');
  const update = vi.spyOn(adapters.store, 'update');
  await rooms.move(client, 10, 0);
  expect(lock).not.toHaveBeenCalled();
  expect(members).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledTimes(1);
  rooms.close();
  await driver.realtime.close();
});
