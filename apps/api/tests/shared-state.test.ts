import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { RealtimeEvent } from '@chibi-town/contracts/realtime';
import { createMemoryAdapters, createPresenceService } from '@chibi-town/realtime-core';
import { expect, it } from 'vitest';
import { createAttemptLimiter } from '@/_utils/attempt-limiter';
import { createChannelPresence } from '@/modules/world/channel-presence';
import { createMapRooms, MAP_LEASE_MS } from '@/modules/world/map-rooms';
import { createRealtimeDriver } from './realtime-test-driver.js';

it('expires shared presence and sign-in failures consistently for both instances', async () => {
  let now = 0;
  const shared = createMemoryAdapters(() => now);
  const a = createChannelPresence(createPresenceService(shared.store, shared.coordination, () => now)),
    b = createChannelPresence(createPresenceService(shared.store, shared.coordination, () => now));
  expect(await a.claim('one', 'entertainment-street', 1, 1, now)).toBe(true);
  expect(await b.claim('two', 'entertainment-street', 1, 1, now)).toBe(false);
  const first = createAttemptLimiter(2, 1000, shared.coordination),
    second = createAttemptLimiter(2, 1000, shared.coordination);
  await Promise.all([first.fail('email', now), second.fail('email', now)]);
  expect(await first.blocked('email', now)).toBe(true);
  now = 300_001;
  expect(await second.blocked('email', now)).toBe(false);
  expect(await b.claim('two', 'entertainment-street', 1, 1, now)).toBe(true);
  expect((await a.population('third', now))('entertainment-street', 1)).toBe(1);
});

it('protects a new map-room owner from an old socket and expires dead process leases', async () => {
  let now = 0;
  const shared = createMemoryAdapters(() => now);
  const a = createRealtimeDriver(shared, () => now),
    b = createRealtimeDriver(shared, () => now);
  const one = createMapRooms(a.realtime, () => now),
    two = createMapRooms(b.realtime, () => now);
  const old = a.connect('same', () => {}),
    fresh = b.connect('same', () => {});
  const player = { id: 'same', name: 'Same', level: 1, outfit: defaultOutfit, x: 1, y: 1 };
  await one.enter(old, 'street', 1, [100, 100], player);
  await two.enter(fresh, 'street', 1, [100, 100], { ...player, x: 2 });
  await one.move(old, 99, 99);
  await one.leave(old);
  const events: RealtimeEvent[] = [];
  const observer = a.connect('observer', (event) => events.push(event));
  await one.enter(observer, 'street', 1, [100, 100], { ...player, id: 'observer' });
  expect(events.find((event) => event.type === 'map.state')).toMatchObject({ players: [{ id: 'same', x: 2 }] });
  now = MAP_LEASE_MS + 1;
  events.length = 0;
  await one.enter(observer, 'street', 1, [100, 100], { ...player, id: 'observer' });
  expect(events.find((event) => event.type === 'map.state')).toMatchObject({ players: [] });
  await a.realtime.close();
  await b.realtime.close();
});
