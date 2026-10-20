import { createMemoryAdapters } from '@chibi-town/realtime-core';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@/app';
import { createTestApp, testConfig } from './test-app.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
});

async function setup() {
  const adapters = createMemoryAdapters();
  const test = await createTestApp({ adapters });
  cleanup.push(test.close);
  const a = await test.register('chat_alice');
  const b = await test.register('chat_bob');

  async function connect(cookie: string, app = test.app) {
    const socket = await app.injectWS('/api/ws', { headers: { cookie, origin: testConfig.webOrigin } });
    cleanup.push(async () => socket.terminate());
    const events: any[] = [];
    socket.on('message', (raw) => events.push(JSON.parse(String(raw))));
    return {
      socket,
      events,

      send(value: unknown) {
        socket.send(JSON.stringify(value));
      },

      async watch(mapId = 'shopping-street', regionId = 'center') {
        const before = events.filter((event) => event.type === 'chat.state').length;
        socket.send(JSON.stringify({ type: 'chat.watch', regionId, mapId }));
        await vi.waitFor(() => expect(events.filter((event) => event.type === 'chat.state')).toHaveLength(before + 1));
        return events.filter((event) => event.type === 'chat.state').at(-1);
      },

      async result(id: string) {
        await vi.waitFor(() =>
          expect(events.some((event) => event.type === 'chat.result' && event.requestId === id)).toBe(true),
        );
        return events.find((event) => event.type === 'chat.result' && event.requestId === id);
      },
    };
  }

  return { test, adapters, a, b, connect };
}

it('broadcasts authentic sender information across API instances, isolates maps/channels and restores history', async () => {
  const t = await setup();
  const other = await createApp({
    db: t.test.db,
    adapters: t.adapters,
    config: testConfig,
    clock: t.test.clock,
    sweepMs: 0,
  });
  await other.app.ready();
  cleanup.push(() => other.app.close());
  const a = await t.connect(t.a.cookie);
  const b = await t.connect(t.b.cookie, other.app);
  await a.watch();
  await b.watch();
  a.send({
    type: 'chat.send',
    requestId: 'hello',
    text: 'Xin chào cả khu 👋',
    name: 'Admin giả',
    playerId: t.b.player.id,
  });
  expect(await a.result('hello')).toMatchObject({ error: null });
  await vi.waitFor(() => expect(b.events.some((event) => event.type === 'chat.message')).toBe(true));
  const message = b.events.find((event) => event.type === 'chat.message').message;
  expect(message).toMatchObject({ playerId: t.a.player.id, name: 'chat_alice', text: 'Xin chào cả khu 👋' });
  await t.test.sdkFor(t.b.cookie).joinMapChannel({ regionId: 'center', mapId: 'shopping-street', channelId: 1 });
  const changed = await b.watch();
  expect(changed).toMatchObject({ scope: { channelId: 1 }, messages: [] });
  t.test.advance(1100);
  a.send({ type: 'chat.send', requestId: 'only-zero', text: 'Chỉ khu 0' });
  await a.result('only-zero');
  expect(b.events.filter((event) => event.type === 'chat.message')).toHaveLength(1);
  t.test.advance(1100);
  const map = await b.watch('entertainment-street', 'fun');
  expect(map.messages).toEqual([]);
  a.send({ type: 'chat.send', requestId: 'only-shopping', text: 'Chỉ phố mua sắm' });
  await a.result('only-shopping');
  expect(b.events.filter((event) => event.type === 'chat.message')).toHaveLength(1);
  t.test.advance(1100);
  const reopened = await a.watch();
  expect(reopened.messages.map((m: any) => m.text)).toEqual(['Xin chào cả khu 👋', 'Chỉ khu 0', 'Chỉ phố mua sắm']);
});

it('deduplicates retries across tabs, rejects reused payloads and shares spam limits per player', async () => {
  const t = await setup();
  const a = await t.connect(t.a.cookie),
    tab = await t.connect(t.a.cookie);
  await a.watch();
  await tab.watch();
  a.send({ type: 'chat.send', requestId: 'once', text: 'Một tin thôi' });
  await a.result('once');
  tab.send({ type: 'chat.send', requestId: 'once', text: 'Một tin thôi' });
  expect(await tab.result('once')).toMatchObject({ error: null });
  expect(tab.events.filter((event) => event.type === 'chat.message')).toHaveLength(1);
  tab.send({ type: 'chat.send', requestId: 'too-fast', text: 'Gửi quá nhanh' });
  expect(await tab.result('too-fast')).toMatchObject({ error: 'TOO_FAST' });
  a.send({ type: 'chat.send', requestId: 'once', text: 'Nội dung bị đổi' });
  await vi.waitFor(() =>
    expect(a.events.some((event) => event.type === 'chat.result' && event.error === 'CONFLICT')).toBe(true),
  );
  t.test.advance(1100);
  tab.send({ type: 'chat.send', requestId: 'next', text: 'Gửi sau một giây' });
  expect(await tab.result('next')).toMatchObject({ error: null });
  t.test.advance(1100);
  expect((await a.watch()).messages).toHaveLength(2);
});

it('supports shared public chat in every registered map and virtual area, keeps only fifty recent messages and rejects sends after leaving', async () => {
  const t = await setup();
  const a = await t.connect(t.a.cookie);
  for (const [regionId, mapId] of [
    ['world', 'world-map'],
    ['farm', 'farm-entrance'],
    ['farm', 'farm-home'],
    ['fun', 'pet-racing'],
    ['center', 'salon'],
  ]) {
    t.test.advance(1100);
    expect(await a.watch(mapId, regionId)).toMatchObject({ scope: { regionId, mapId, channelId: 0 } });
  }
  for (let n = 0; n < 52; n++) {
    t.test.advance(1100);
    a.send({ type: 'chat.send', requestId: `line-${n}`, text: `Tin ${n}` });
    expect(await a.result(`line-${n}`)).toMatchObject({ error: null });
  }
  t.test.advance(1100);
  const history = await a.watch('salon');
  expect(history.messages).toHaveLength(50);
  expect(history.messages[0].text).toBe('Tin 2');
  a.send({ type: 'chat.leave' });
  a.send({ type: 'chat.send', requestId: 'left', text: 'Đã rời kênh' });
  expect(await a.result('left')).toMatchObject({ error: 'NOT_READY' });
});
