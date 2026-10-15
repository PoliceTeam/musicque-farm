import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { MapPlayer, RealtimeEvent } from '@chibi-town/contracts/realtime';
import { createMemoryAdapters } from '@chibi-town/realtime-core';
import { afterEach, expect, it, vi } from 'vitest';
import { createMapRooms } from '@/modules/world/map-rooms';
import { createRealtimeDriver } from './realtime-test-driver.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
  vi.useRealTimers();
});

function room() {
  vi.useFakeTimers();
  const adapters = createMemoryAdapters();
  const driver = createRealtimeDriver(adapters);
  const rooms = createMapRooms(driver.realtime);
  cleanup.push(async () => {
    rooms.close();
    await driver.realtime.close();
  });
  const events: RealtimeEvent[] = [];
  const observer = driver.connect('observer', (event) => events.push(event));

  const player = (id: string): MapPlayer => ({ id, name: id, level: 1, outfit: defaultOutfit, x: 0, y: 0 });

  return { adapters, driver, rooms, events, observer, player };
}

it('batches latest valid positions for all players once per room tick and isolates rooms', async () => {
  const { driver, rooms, events, observer, player } = room();
  await driver.realtime.subscribe(observer, 'map:street:1');
  const a = driver.connect('a', () => {}),
    b = driver.connect('b', () => {}),
    far = driver.connect('far', () => {});
  await rooms.enter(a, 'street', 1, [100, 100], player('a'));
  await rooms.enter(b, 'street', 1, [100, 100], player('b'));
  await rooms.enter(far, 'street', 2, [100, 100], player('far'));
  events.length = 0;
  await rooms.move(a, 10, 0);
  await rooms.move(a, 20, 0);
  await rooms.move(b, 0, 20);
  await rooms.move(b, 100, 100); // rejected by the movement bank
  await rooms.move(far, 5, 0);
  await vi.advanceTimersByTimeAsync(99);
  expect(events).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(events).toEqual([
    {
      type: 'map.moves',
      moves: [
        { id: 'a', x: 20, y: 0 },
        { id: 'b', x: 0, y: 20 },
      ],
    },
  ]);
  await rooms.move(a, 25, 0);
  await vi.advanceTimersByTimeAsync(100);
  expect(events[1]).toEqual({ type: 'map.moves', moves: [{ id: 'a', x: 25, y: 0 }] });
});

it('discards pending positions when leaving, changing rooms or being replaced on another instance', async () => {
  const { adapters, driver, rooms, events, observer, player } = room();
  const other = createRealtimeDriver(adapters);
  const otherRooms = createMapRooms(other.realtime);
  cleanup.push(async () => {
    otherRooms.close();
    await other.realtime.close();
  });
  await driver.realtime.subscribe(observer, 'map:street:1');
  const left = driver.connect('left', () => {}),
    changed = driver.connect('changed', () => {}),
    old = driver.connect('same', () => {});
  for (const connection of [left, changed, old])
    await rooms.enter(connection, 'street', 1, [100, 100], player(connection.identity.playerId));
  await rooms.move(left, 10, 0);
  await rooms.leave(left);
  await rooms.move(changed, 10, 0);
  await rooms.enter(changed, 'street', 2, [100, 100], player('changed'));
  await rooms.move(old, 10, 0);
  const fresh = other.connect('same', () => {});
  await otherRooms.enter(fresh, 'street', 1, [100, 100], player('same'));
  events.length = 0;
  await vi.advanceTimersByTimeAsync(100);
  expect(events).toEqual([]);
});

it('keeps one pending batch behind a slow flush without overlapping or reordering room ticks', async () => {
  const { driver, rooms, events, observer, player } = room();
  await driver.realtime.subscribe(observer, 'map:street:1');
  const client = driver.connect('a', () => {});
  await rooms.enter(client, 'street', 1, [100, 100], player('a'));
  events.length = 0;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const takeChanges = driver.realtime.rooms.takeChanges;
  const read = vi.spyOn(driver.realtime.rooms, 'takeChanges').mockImplementation(async (...args) => {
    await blocked;
    return takeChanges(...args);
  });
  await rooms.move(client, 10, 0);
  await vi.advanceTimersByTimeAsync(100);
  try {
    for (let i = 1; i <= 10; i++) {
      await rooms.move(client, 10 + i, 0);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(read).toHaveBeenCalledTimes(1);
  } finally {
    release();
    await vi.advanceTimersByTimeAsync(0);
  }
  await vi.advanceTimersByTimeAsync(100);
  expect(events).toEqual([{ type: 'map.moves', moves: [{ id: 'a', x: 20, y: 0 }] }]);
  await rooms.move(client, 25, 0);
  await vi.advanceTimersByTimeAsync(100);
  expect(events[1]).toEqual({ type: 'map.moves', moves: [{ id: 'a', x: 25, y: 0 }] });
});

it('emits one combined room tick when players move on two API instances', async () => {
  const { adapters, driver, rooms, events, observer, player } = room();
  const peer = createRealtimeDriver(adapters);
  const peerRooms = createMapRooms(peer.realtime);
  cleanup.push(async () => {
    await peerRooms.close();
    await peer.realtime.close();
  });
  await driver.realtime.subscribe(observer, 'map:street:1');
  const a = driver.connect('a', () => {}),
    b = peer.connect('b', () => {});
  await rooms.enter(a, 'street', 1, [100, 100], player('a'));
  await peerRooms.enter(b, 'street', 1, [100, 100], player('b'));
  events.length = 0;
  await rooms.move(a, 10, 0);
  await peerRooms.move(b, 20, 0);
  await vi.advanceTimersByTimeAsync(100);
  expect(events).toEqual([
    {
      type: 'map.moves',
      moves: [
        { id: 'a', x: 10, y: 0 },
        { id: 'b', x: 20, y: 0 },
      ],
    },
  ]);
});
