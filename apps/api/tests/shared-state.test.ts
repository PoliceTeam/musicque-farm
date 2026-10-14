import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { RealtimeEvent } from '@chibi-town/contracts/realtime';
import { expect, it } from 'vitest';
import { createAttemptLimiter } from '@/_utils/attempt-limiter';
import { createChannelPresence } from '@/modules/game/channel-presence';
import { createMapRooms, MAP_LEASE_MS } from '@/modules/realtime/map-rooms';
import { createRealtimeHub } from '@/modules/realtime/realtime-hub';
import { createMemorySharedState } from '@/modules/realtime/shared-state';

it('expires shared presence and sign-in failures consistently for both instances', async () => {
  let now = 0;
  const shared = createMemorySharedState(() => now);
  const a = createChannelPresence(1000, shared),
    b = createChannelPresence(1000, shared);
  expect(await a.claim('one', 'street', 1, 1, now)).toBe(true);
  expect(await b.claim('two', 'street', 1, 1, now)).toBe(false);
  const first = createAttemptLimiter(2, 1000, shared),
    second = createAttemptLimiter(2, 1000, shared);
  await Promise.all([first.fail('email', now), second.fail('email', now)]);
  expect(await first.blocked('email', now)).toBe(true);
  now = 1001;
  expect(await second.blocked('email', now)).toBe(false);
  expect(await b.claim('two', 'street', 1, 1, now)).toBe(true);
  expect(await a.others('third', 'street', 1, now)).toBe(1);
});

it('protects a new map-room owner from an old socket and expires dead process leases', async () => {
  let now = 0;
  const shared = createMemorySharedState(() => now);
  const a = createRealtimeHub(shared),
    b = createRealtimeHub(shared);
  const one = createMapRooms(a, shared),
    two = createMapRooms(b, shared);
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
  a.close();
  b.close();
});
