import { createRealtimeClient } from '@chibi-town/api-sdk';
import { Action } from '@chibi-town/character-core/animation-logic';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { decodeRealtimeCommand, decodeRealtimeEvent, type MapPlayer } from '@chibi-town/contracts/realtime';
import { describe, expect, it } from 'vitest';
import { createRemotePlayers } from '@/features/location/_utils/remote-players-logic';

const player = (id: string, x = 0, y = 0): MapPlayer => ({
  id,
  name: id,
  level: 1,
  outfit: { ...defaultOutfit },
  x,
  y,
});

describe('remote players in a map channel', () => {
  it('keeps an equipped pet with remote players and clears it when the outfit changes', () => {
    const others = createRemotePlayers('me');
    others.apply({
      type: 'map.join',
      player: { ...player('a', 100, 100), outfit: { ...defaultOutfit, pet: 'panda', petLevel: '1' } },
    });
    const remote = others.players.get('a')!;
    expect(remote.pet?.def.id).toBe('panda');
    const initialX = remote.pet!.x;
    others.apply({ type: 'map.moves', moves: [{ id: 'a', x: 200, y: 100 }] });
    for (let i = 0; i < 20; i++) others.step(0.05);
    expect(remote.pet!.x).toBeGreaterThan(initialX);
    others.apply({ type: 'map.join', player: player('a', 200, 100) });
    expect(others.players.get('a')?.pet).toBeUndefined();
  });

  it('follows server events and never adds the local player', () => {
    const others = createRemotePlayers('me');
    others.apply({ type: 'map.state', mapId: 'street', channelId: 0, players: [player('a'), player('me')] });
    others.apply({ type: 'map.join', player: player('b', 50, 50) });
    others.apply({ type: 'map.join', player: player('me') });
    expect([...others.players.keys()]).toEqual(['a', 'b']);
    others.apply({ type: 'map.leave', id: 'a' });
    others.apply({ type: 'map.moves', moves: [{ id: 'gone', x: 1, y: 1 }] });
    expect([...others.players.keys()]).toEqual(['b']);
    others.apply({ type: 'reconnected' });
    expect(others.players.size).toBe(0);
    others.apply({ type: 'map.state', mapId: 'street', channelId: 1, players: [] });
    expect(others.players.size).toBe(0);
  });

  it('applies every position in a batch, ignoring self and unknown players', () => {
    const others = createRemotePlayers('me');
    others.apply({ type: 'map.state', mapId: 'street', channelId: 0, players: [player('a'), player('b')] });
    others.apply({
      type: 'map.moves',
      moves: [
        { id: 'a', x: 10, y: 20 },
        { id: 'b', x: 30, y: 40 },
        { id: 'me', x: 5, y: 5 },
        { id: 'missing', x: 1, y: 1 },
      ],
    });
    expect([...others.players.values()].map((value) => value.target)).toEqual([
      [10, 20],
      [30, 40],
    ]);
    expect(others.players.size).toBe(2);
  });

  it('walks towards a reported position at walking speed and stops there', () => {
    const others = createRemotePlayers('me');
    others.apply({ type: 'map.join', player: player('a', 100, 100) });
    others.apply({ type: 'map.moves', moves: [{ id: 'a', x: 40, y: 100 }] });
    others.step(0.25);
    const walker = others.players.get('a')!;
    expect([walker.x, walker.y]).toEqual([70, 100]);
    expect([walker.avatar.action, walker.avatar.mirror]).toEqual([Action.Walk, true]);
    others.step(1);
    others.step(0.1);
    expect([walker.x, walker.y, walker.avatar.action]).toEqual([40, 100, Action.Stand]);
  });

  it('places a far-away player directly instead of running across the map', () => {
    const others = createRemotePlayers('me');
    others.apply({ type: 'map.join', player: player('a', 0, 0) });
    others.apply({ type: 'map.moves', moves: [{ id: 'a', x: 900, y: 0 }] });
    others.step(0.016);
    expect(others.players.get('a')!.x).toBe(900);
  });
});

describe('realtime messages', () => {
  it('validates race notifications and strips outcome data', () => {
    expect(decodeRealtimeCommand({ type: 'pet-race.watch' })).toEqual({ type: 'pet-race.watch' });
    expect(decodeRealtimeCommand({ type: 'pet-race.unwatch' })).toEqual({ type: 'pet-race.unwatch' });
    const event = { type: 'pet-race.changed', roundId: 'race-123', phase: 'betting' };
    expect(decodeRealtimeEvent({ ...event, winner: 3 })).toEqual(event);
    expect(decodeRealtimeEvent({ ...event, phase: 'invalid' })).toBeUndefined();
    expect(decodeRealtimeEvent({ ...event, roundId: '../private' })).toBeUndefined();
  });

  it('accepts well-formed commands and rejects everything else', () => {
    expect(decodeRealtimeCommand({ type: 'map.move', x: 1, y: 2, extra: true })).toEqual({
      type: 'map.move',
      x: 1,
      y: 2,
    });
    expect(decodeRealtimeCommand({ type: 'lobby.watch', gameId: 'tien-len' })).toEqual({
      type: 'lobby.watch',
      gameId: 'tien-len',
    });
    for (const bad of [
      null,
      'map.leave',
      { type: 'map.move', x: Number.NaN, y: 0 },
      { type: 'map.move', x: -1, y: 0 },
      { type: 'map.enter', regionId: 'fun', mapId: '../etc', x: 0, y: 0 },
      { type: 'lobby.watch', gameId: 'poker' },
      { type: 'subscribe', topic: 'map:x:0' },
    ])
      expect(decodeRealtimeCommand(bad)).toBeUndefined();
  });

  it('validates a whole move batch before delivering it', () => {
    expect(decodeRealtimeEvent({ type: 'map.moves', moves: [{ id: 'a', x: 1, y: 2, extra: true }] })).toEqual({
      type: 'map.moves',
      moves: [{ id: 'a', x: 1, y: 2 }],
    });
    for (const moves of [
      null,
      {},
      [null],
      [
        { id: 'a', x: 1, y: 2 },
        { id: 'b', x: -1, y: 0 },
      ],
      Array.from({ length: 1001 }, () => ({ id: 'a', x: 0, y: 0 })),
    ])
      expect(decodeRealtimeEvent({ type: 'map.moves', moves })).toBeUndefined();
  });

  it('drops malformed events before they reach listeners', () => {
    expect(decodeRealtimeEvent({ type: 'map.join', player: { ...player('a'), outfit: null } })).toBeUndefined();
    expect(decodeRealtimeEvent({ type: 'map.state', mapId: 'm', channelId: 0, players: [{}] })).toBeUndefined();
    expect(decodeRealtimeEvent({ type: 'reconnected' })).toBeUndefined();
    expect(decodeRealtimeEvent({ type: 'match', gameId: 'phom' })).toEqual({ type: 'match', gameId: 'phom' });
  });
});

describe('realtime client', () => {
  function harness(random = () => 0.5) {
    const sockets: {
      sent: string[];
      readyState: number;
      onopen?: () => void;
      onmessage?: (e: { data: unknown }) => void;
      onclose?: () => void;
      close(): void;
    }[] = [];
    const timers: { task: () => void; ms: number }[] = [];
    const client = createRealtimeClient({
      url: 'ws://api.test/api/ws',
      retryMs: 100,
      random,

      schedule: (task, ms) => timers.push({ task, ms }),

      open: () => {
        const socket = {
          sent: [] as string[],
          readyState: 0,

          send(data: string) {
            this.sent.push(data);
          },

          close() {
            this.readyState = 3;
          },
        };
        sockets.push(socket as never);
        return socket as never;
      },
    });

    const open = (index: number) => {
      sockets[index].readyState = 1;
      sockets[index].onopen?.();
    };

    const drop = (index: number) => {
      sockets[index].readyState = 3;
      sockets[index].onclose?.();
    };

    return { client, sockets, timers, open, drop };
  }

  it('restores the private social subscription after reconnect and decodes invalidations', () => {
    const { client, sockets, timers, open, drop } = harness();
    const seen: string[] = [];
    client.subscribe((event) => seen.push(event.type));
    client.send({ type: 'social.watch' });
    open(0);
    expect(sockets[0].sent.map((raw) => JSON.parse(raw))).toEqual([{ type: 'social.watch' }]);
    sockets[0].onmessage?.({ data: '{"type":"social.changed"}' });
    expect(seen).toEqual(['social.changed']);
    drop(0);
    timers[0].task();
    open(1);
    expect(sockets[1].sent.map((raw) => JSON.parse(raw))).toEqual([{ type: 'social.watch' }]);
    expect(seen).toEqual(['social.changed', 'disconnected', 'reconnected']);
    expect(decodeRealtimeCommand({ type: 'social.watch', playerId: 'another-user' })).toEqual({ type: 'social.watch' });
    client.close();
  });

  it('re-enters the map at the latest position and re-watches the lobby after a reconnect', () => {
    const { client, sockets, timers, open, drop } = harness();
    client.send({ type: 'map.move', x: 1, y: 1 });
    expect(sockets[0].sent).toEqual([]);
    open(0);
    client.send({ type: 'map.enter', regionId: 'fun', mapId: 'street', x: 10, y: 10 });
    client.send({ type: 'map.move', x: 30, y: 40 });
    client.send({ type: 'lobby.watch', gameId: 'chess' });
    drop(0);
    drop(0);
    expect(timers.map((timer) => timer.ms)).toEqual([100]);
    timers[0].task();
    drop(1);
    expect(timers[1].ms).toBe(200);
    timers[1].task();
    open(2);
    expect(sockets[2].sent.map((data) => JSON.parse(data))).toEqual([
      { type: 'map.enter', regionId: 'fun', mapId: 'street', x: 30, y: 40 },
      { type: 'lobby.watch', gameId: 'chess' },
    ]);
    client.send({ type: 'map.leave' });
    client.send({ type: 'lobby.unwatch' });
    drop(2);
    timers[2].task();
    open(3);
    expect(sockets[3].sent).toEqual([]);
  });

  it('replays the race subscription independently of map and lobby watches', () => {
    const { client, sockets, timers, open, drop } = harness();
    open(0);
    client.send({ type: 'lobby.watch', gameId: 'chess' });
    client.send({ type: 'pet-race.watch' });
    drop(0);
    timers[0].task();
    open(1);
    expect(sockets[1].sent.map((raw) => JSON.parse(raw))).toEqual([
      { type: 'lobby.watch', gameId: 'chess' },
      { type: 'pet-race.watch' },
    ]);
    client.send({ type: 'pet-race.unwatch' });
    drop(1);
    timers[1].task();
    open(2);
    expect(sockets[2].sent.map((raw) => JSON.parse(raw))).toEqual([{ type: 'lobby.watch', gameId: 'chess' }]);
    client.close();
  });

  it('emits reconnected once after reopening and adds jitter to retry delays', () => {
    const { client, sockets, timers, open, drop } = harness(() => 0.25);
    const seen: string[] = [];
    client.subscribe((event) => seen.push(event.type));
    open(0);
    expect(seen).toEqual([]);
    drop(0);
    expect(timers[0].ms).toBe(75);
    timers[0].task();
    open(1);
    expect(seen).toEqual(['disconnected', 'reconnected']);
    sockets[0].onmessage?.({ data: '{"type":"match","gameId":"chess"}' });
    expect(seen).toEqual(['disconnected', 'reconnected']);
    client.close();
    sockets[1].onopen?.();
    expect(seen).toEqual(['disconnected', 'reconnected']);
  });

  it('delivers a validated move batch as one notification', () => {
    const { client, sockets, open } = harness();
    open(0);
    const seen: unknown[] = [];
    client.subscribe((event) => seen.push(event));
    const batch = {
      type: 'map.moves',
      moves: [
        { id: 'a', x: 10, y: 20 },
        { id: 'b', x: 30, y: 40 },
      ],
    };
    sockets[0].onmessage?.({ data: JSON.stringify(batch) });
    sockets[0].onmessage?.({ data: JSON.stringify({ type: 'map.moves', moves: [null] }) });
    expect(seen).toEqual([batch]);
    client.close();
  });

  it('delivers valid events to listeners until they unsubscribe or the client closes', () => {
    const { client, sockets, timers, open, drop } = harness();
    open(0);
    const seen: string[] = [];
    const off = client.subscribe((event) => seen.push(event.type));
    sockets[0].onmessage?.({ data: '{"type":"lobby","gameId":"phom"}' });
    sockets[0].onmessage?.({ data: 'garbage' });
    sockets[0].onmessage?.({ data: '{"type":"unknown"}' });
    off();
    sockets[0].onmessage?.({ data: '{"type":"lobby","gameId":"phom"}' });
    expect(seen).toEqual(['lobby']);
    client.close();
    drop(0);
    expect(timers).toHaveLength(0);
  });
});
