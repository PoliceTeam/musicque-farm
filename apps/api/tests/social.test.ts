import { randomUUID } from 'node:crypto';
import { decodeFriendList, decodePublicProfile } from '@chibi-town/contracts/social';
import { createMemoryAdapters } from '@chibi-town/realtime-core';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { friendships, players } from '@/infrastructure/database/schema';
import { createTestApp, testConfig } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(() => t.close());

async function post(cookie: string, targetId: string, action: string) {
  return t.app.inject({
    method: 'POST',
    url: '/api/social/friends',
    headers: { cookie },
    payload: { targetId, action },
  });
}

async function list(cookie: string) {
  const response = await t.app.inject({ url: '/api/social/friends', headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return decodeFriendList(response.json());
}

it('persists one mutual relationship, exposes pending lists to both parties and enforces recipient-only acceptance', async () => {
  const a = await t.register('social_a');
  const b = await t.register('social_b');
  const c = await t.register('social_c');
  expect((await t.app.inject({ url: '/api/social/friends' })).statusCode).toBe(401);
  expect((await post(a.cookie, a.player.id, 'request')).statusCode).toBe(400);
  const sent = await Promise.all([post(a.cookie, b.player.id, 'request'), post(a.cookie, b.player.id, 'request')]);
  expect(sent.map((r) => r.statusCode)).toEqual([200, 200]);
  expect((await list(a.cookie)).entries[0].state).toBe('outgoing');
  expect((await list(b.cookie)).entries[0].state).toBe('incoming');
  expect((await list(c.cookie)).entries).toHaveLength(0);
  expect((await post(a.cookie, b.player.id, 'accept')).statusCode).toBe(403);
  expect((await post(c.cookie, a.player.id, 'accept')).statusCode).toBe(403);
  // A crossed request leaves the existing invitation intact; consent remains explicit.
  expect((await post(b.cookie, a.player.id, 'request')).json().relationship).toBe('incoming');
  expect((await post(b.cookie, a.player.id, 'accept')).statusCode).toBe(200);
  expect((await post(b.cookie, a.player.id, 'accept')).statusCode).toBe(200);
  expect((await list(a.cookie)).entries[0].state).toBe('friends');
  expect((await list(b.cookie)).entries[0].state).toBe('friends');
  expect(await t.db.select().from(friendships)).toHaveLength(1);
  expect((await post(a.cookie, b.player.id, 'cancel')).statusCode).toBe(403);
  expect((await post(a.cookie, b.player.id, 'remove')).statusCode).toBe(200);
  expect((await list(b.cookie)).entries).toHaveLength(0);
  const cooldown = await post(a.cookie, b.player.id, 'request');
  expect(cooldown.statusCode).toBe(409);
  expect(cooldown.json()).toEqual({ code: 'FRIEND_REQUEST_COOLDOWN', retryAfterSeconds: 60 });
  t.advance(60_001);
  expect((await post(b.cookie, a.player.id, 'request')).statusCode).toBe(200);
  expect((await post(a.cookie, b.player.id, 'decline')).statusCode).toBe(200);
  expect((await list(b.cookie)).entries).toHaveLength(0);
});

it('validates targets, permits sender cancellation and keeps wallet, email, username and inventory private', async () => {
  const a = await t.register('profile_a');
  const b = await t.register('profile_b');
  expect((await post(a.cookie, 'bad', 'request')).statusCode).toBe(400);
  expect((await post(a.cookie, '00000000-0000-4000-8000-000000000001', 'request')).statusCode).toBe(403);
  expect((await post(a.cookie, b.player.id, 'give-coins')).statusCode).toBe(400);
  await post(a.cookie, b.player.id, 'request');
  expect((await post(b.cookie, a.player.id, 'cancel')).statusCode).toBe(403);
  expect((await post(a.cookie, b.player.id, 'cancel')).statusCode).toBe(200);
  const response = await t.app.inject({ url: `/api/social/players/${b.player.id}`, headers: { cookie: a.cookie } });
  const profile = decodePublicProfile(response.json());
  expect(profile.name).toBe(b.player.name);
  expect(profile.relationship).toBe('none');
  for (const key of ['username', 'email', 'coins', 'gems', 'passwordHash', 'characterInventory', 'document'])
    expect(response.json()).not.toHaveProperty(key);
  const friends = await list(a.cookie);
  expect(friends.entries).toHaveLength(0);
});

it('preserves relation constraints and cascades account deletion', async () => {
  const a = await t.register('constraint_a');
  const b = await t.register('constraint_b');
  const c = await t.register('constraint_c');
  const [lowId, highId] = [a.player.id, b.player.id].sort();
  await expect(
    t.db.insert(friendships).values({ lowId: highId, highId: lowId, requestedBy: a.player.id, status: 'pending' }),
  ).rejects.toThrow();
  await expect(
    t.db.insert(friendships).values({ lowId, highId, requestedBy: c.player.id, status: 'pending' }),
  ).rejects.toThrow();
  await post(a.cookie, b.player.id, 'request');
  await t.db.delete(players).where(eq(players.id, b.player.id));
  expect(
    await t.db
      .select()
      .from(friendships)
      .where(and(eq(friendships.lowId, lowId), eq(friendships.highId, highId))),
  ).toHaveLength(0);
});

it('notifies only the two authenticated participants, including recipients on a second API instance', async () => {
  const adapters = createMemoryAdapters(t.clock);
  const first = await createTestApp({
    database: {
      db: t.db,

      close: async () => {},
    },
    adapters,
  });
  const second = await createTestApp({
    database: {
      db: t.db,

      close: async () => {},
    },
    adapters,
  });
  const a = await t.register('notify_a');
  const b = await t.register('notify_b');
  const c = await t.register('notify_c');
  await Promise.all([first.app.ready(), second.app.ready()]);
  const sockets = await Promise.all(
    [first, second, second].map((app, i) =>
      app.app.injectWS('/api/ws', { headers: { cookie: [a, b, c][i].cookie, origin: testConfig.webOrigin } }),
    ),
  );
  const messages: string[][] = [[], [], []];
  try {
    sockets.forEach((socket, i) => {
      socket.on('message', (raw) => messages[i].push(String(raw)));
      socket.send(JSON.stringify({ type: 'social.watch', playerId: a.player.id }));
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await first.app.inject({
      method: 'POST',
      url: '/api/social/friends',
      headers: { cookie: a.cookie },
      payload: { targetId: b.player.id, action: 'request' },
    });
    await vi.waitFor(() => {
      expect(messages[0]).toContain('{"type":"social.changed"}');
      expect(messages[1]).toContain('{"type":"social.changed"}');
    });
    expect(messages[2]).toHaveLength(0);
  } finally {
    sockets.forEach((socket) => {
      socket.terminate();
    });
    await first.close();
    await second.close();
    await adapters.close();
  }
});

it('bounds pending requests and rejects acceptance when either friendship list is full', async () => {
  const a = await t.register('quota_a');
  const b = await t.register('quota_b');
  const ids = Array.from({ length: 200 }, () => randomUUID());
  await t.db.insert(players).values(ids.map((id) => ({ id, name: 'Quota fixture' })));

  const row = (id: string, status: string) => {
    const [lowId, highId] = [a.player.id, id].sort();
    return { lowId, highId, requestedBy: a.player.id, status };
  };

  await t.db.insert(friendships).values(ids.slice(0, 50).map((id) => row(id, 'pending')));
  expect((await post(a.cookie, b.player.id, 'request')).json().code).toBe('FRIEND_REQUESTS_FULL');
  expect((await post(b.cookie, a.player.id, 'request')).json().code).toBe('TARGET_FRIEND_REQUESTS_FULL');
  await t.db.delete(friendships);
  await post(b.cookie, a.player.id, 'request');
  await t.db.insert(friendships).values(ids.map((id) => row(id, 'accepted')));
  expect((await post(a.cookie, b.player.id, 'accept')).json().code).toBe('FRIEND_LIST_FULL');
  expect((await list(b.cookie)).entries[0].state).toBe('outgoing');
});
