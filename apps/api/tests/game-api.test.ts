import { ApiSdkError, type Command } from '@chibi-town/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

const home = { regionId: 'farm', mapId: 'farm-home', instanceId: 'home' };

const till = (requestId: string, index = 0): Command => ({
  requestId,
  mapInstanceId: 'home',
  type: 'plot',
  index,
  action: 'till',
});

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error) => (error instanceof ApiSdkError ? error.code : String(error)),
  );

describe('game API through the HTTP SDK', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('serves the account identity with the saved outfit', async () => {
    const { cookie, player } = await t.register('identity');
    const sdk = t.sdkFor(cookie);
    expect(await sdk.getPlayer()).toMatchObject({ id: player.id, name: 'identity', level: 1 });
    expect((await sdk.getWorld()).regions.length).toBeGreaterThan(0);
  });

  it('saves farm progress on the server with the server clock', async () => {
    const sdk = t.sdkFor((await t.register('farmer')).cookie);
    const before = await sdk.getMap(home);
    expect(before.serverTime).toBe(1_700_000_000_000);
    const result = await sdk.execute(till('till-1'));
    expect(result.completed).toBe(1);
    expect(result.farm.plots[0].stage).not.toBe(before.farm.plots[0].stage);
    expect((await sdk.getInventory()).farm.plots[0]).toEqual(result.farm.plots[0]);
  });

  it('applies a retried request once and rejects a reused id with another payload', async () => {
    const sdk = t.sdkFor((await t.register('retry')).cookie);
    const first = await sdk.execute(till('same'));
    const retry = await sdk.execute(till('same'));
    expect(retry.revision).toBe(first.revision);
    expect(retry.farm).toEqual(first.farm);
    expect(await code(sdk.execute(till('same', 1)))).toBe('REQUEST_CONFLICT');
  });

  it('keeps players apart', async () => {
    const one = t.sdkFor((await t.register('one')).cookie);
    const two = t.sdkFor((await t.register('two')).cookie);
    const untouched = await two.getMap(home);
    await one.execute(till('mine'));
    expect((await two.getMap(home)).farm).toEqual(untouched.farm);
    expect((await two.execute(till('mine'))).completed).toBe(1);
  });

  it('does not lose commands sent at the same time', async () => {
    const sdk = t.sdkFor((await t.register('burst')).cookie);
    const results = await Promise.all([0, 1, 2, 3, 4].map((index) => sdk.execute(till(`burst-${index}`, index))));
    expect(results.every((result) => result.completed === 1)).toBe(true);
    const saved = await sdk.getMap(home);
    expect(saved.farm.plots.slice(0, 5).every((plot) => plot.stage === results[0].farm.plots[0].stage)).toBe(true);
  });

  it('maps rule errors to their codes and rejects malformed bodies', async () => {
    const { cookie } = await t.register('errors');
    const sdk = t.sdkFor(cookie);
    expect(await code(sdk.getMap({ ...home, mapId: 'missing' }))).toBe('MAP_NOT_FOUND');

    const raw = (payload: string) =>
      t.app.inject({
        method: 'POST',
        url: '/api/commands',
        headers: { cookie, 'content-type': 'application/json' },
        payload,
      });

    const malformed = await raw('{not json');
    expect([malformed.statusCode, malformed.json()]).toEqual([400, { code: 'INVALID_COMMAND' }]);
    const unknown = await raw(JSON.stringify({ requestId: 'x', mapInstanceId: 'home', type: 'grant-coins' }));
    expect([unknown.statusCode, unknown.json()]).toEqual([400, { code: 'INVALID_COMMAND' }]);
    expect((await t.app.inject({ url: '/api/nowhere', headers: { cookie } })).statusCode).toBe(404);
  });

  it('runs a practice arcade match against the bot on the server', async () => {
    const { cookie, player } = await t.register('arcade');
    const sdk = t.sdkFor(cookie);
    const lobby = await sdk.getArcadeLobby();
    expect(lobby.source).toBe('live');
    const practice = lobby.rooms.at(-1)!;
    const battle = await sdk.startDiamondRoom({ roomId: practice.id, tableId: 0, requestId: 'start-1' });
    expect(battle.status).toBe('waiting');
    // The table UI enables host controls by comparing these two ids.
    expect(battle.session?.hostId).toBe(player.id);
    expect((await sdk.getPlayer()).id).toBe(player.id);
    await sdk.configureArcadeTable({
      gameId: 'diamonds',
      matchId: battle.id,
      revision: battle.revision,
      requestId: 'configure-1',
      stake: 0,
      difficulty: 'easy',
    });
    const resumed = (await sdk.getArcadeLobby()).activeBattle!;
    const started = await sdk.playDiamond({
      requestId: 'play-1',
      battleId: resumed.id,
      revision: resumed.revision,
      action: { type: 'start' },
    });
    expect(started.battle.status).toBe('playing');
    expect(await code(sdk.startDiamondRoom({ roomId: practice.id, tableId: 1, requestId: 'start-2' }))).toBe(
      'MATCH_IN_PROGRESS',
    );
    expect((await sdk.getMiniLobby('slots')).gameId).toBe('slots');
    expect((await sdk.getTienLobby()).rooms.length).toBe(lobby.rooms.length);
    expect((await sdk.getPhomLobby()).rooms.length).toBe(lobby.rooms.length);
  });

  it('counts real players per channel', async () => {
    const street = { regionId: 'fun', mapId: 'entertainment-street' };
    const first = t.sdkFor((await t.register('street-a')).cookie);
    const second = t.sdkFor((await t.register('street-b')).cookie);
    const directory = await first.joinMapChannel({ ...street, channelId: 3 });
    expect(directory.source).toBe('live');
    expect(directory.channels[3].occupants).toBe(1);
    expect(directory.channels[5].occupants).toBe(0);
    expect((await second.getMapChannels(street)).channels[3].occupants).toBe(1);
    expect((await second.joinMapChannel({ ...street, channelId: 3 })).channels[3].occupants).toBe(2);
    await first.joinMapChannel({ ...street, channelId: 4 });
    expect((await second.getMapChannels(street)).channels[3].occupants).toBe(1);
    t.advance(6 * 60_000);
    expect((await second.getMapChannels(street)).channels[4].occupants).toBe(0);
  });

  it('lets exactly the capacity in when players join a channel at once', async () => {
    const street = { regionId: 'fun', mapId: 'entertainment-street' };
    const players = await Promise.all(Array.from({ length: 31 }, (_, index) => t.register(`crowd-${index}`)));
    const outcomes = await Promise.all(
      players.map(({ cookie }) => code(t.sdkFor(cookie).joinMapChannel({ ...street, channelId: 9 }))),
    );
    expect(outcomes.filter((outcome) => outcome === 'resolved')).toHaveLength(30);
    expect(outcomes.filter((outcome) => outcome === 'CHANNEL_FULL')).toHaveLength(1);
  });
});

describe('realtime map rooms', () => {
  const street = { regionId: 'fun', mapId: 'entertainment-street' };
  const origin = 'http://game.test';

  async function connect(t: Awaited<ReturnType<typeof createTestApp>>, cookie: string) {
    const socket = await t.app.injectWS('/api/ws', { headers: { cookie, origin } });
    const events: { type: string; [key: string]: unknown }[] = [];
    socket.on('message', (data) => events.push(JSON.parse(String(data))));

    const send = (command: object) => socket.send(JSON.stringify(command));

    /** Resolves once an event of this type has arrived after the call. */
    const next = (type: string) => {
      const from = events.length;
      return new Promise<(typeof events)[number]>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${type} event`)), 2000);

        const check = () => {
          const found = events.slice(from).find((event) => event.type === type);
          if (!found) return setTimeout(check, 5);
          clearTimeout(timer);
          resolve(found);
        };

        check();
      });
    };

    return { socket, events, send, next };
  }

  it('refuses a handshake without a session or from another origin', async () => {
    const t = await createTestApp();
    const { cookie } = await t.register('ws-auth');
    await expect(t.app.injectWS('/api/ws', { headers: { origin } })).rejects.toThrow();
    await expect(t.app.injectWS('/api/ws', { headers: { cookie, origin: 'http://evil.test' } })).rejects.toThrow();
    await t.close();
  });

  it('shows players of the same channel to each other and nobody else', async () => {
    const t = await createTestApp();
    const [a, b, c] = await Promise.all(['ws-a', 'ws-b', 'ws-c'].map((name) => t.register(name)));
    await t.sdkFor(c.cookie).joinMapChannel({ ...street, channelId: 2 });
    const [one, two, far] = await Promise.all([a, b, c].map((player) => connect(t, player.cookie)));

    let state = one.next('map.state');
    one.send({ type: 'map.enter', ...street, x: 100, y: 200 });
    expect((await state).players).toEqual([]);

    state = two.next('map.state');
    const joined = one.next('map.join');
    two.send({ type: 'map.enter', ...street, x: 300, y: 400 });
    expect((await state).players).toMatchObject([{ id: a.player.id, name: 'ws-a', x: 100, y: 200 }]);
    expect((await joined).player).toMatchObject({ id: b.player.id, x: 300, y: 400 });

    state = far.next('map.state');
    far.send({ type: 'map.enter', ...street, x: 5, y: 5 });
    expect(await state).toMatchObject({ channelId: 2, players: [] });

    const moved = one.next('map.moves');
    two.send({ type: 'map.move', x: 320, y: 410 });
    expect(await moved).toEqual({ type: 'map.moves', moves: [{ id: b.player.id, x: 320, y: 410 }] });
    expect((await t.sdkFor(a.cookie).getMapChannels(street)).channels[0].occupants).toBe(2);

    const left = one.next('map.leave');
    two.socket.terminate();
    expect(await left).toEqual({ type: 'map.leave', id: b.player.id });
    expect(far.events.map((event) => event.type)).toEqual(['map.state']);
    expect(two.events.filter((event) => event.type === 'map.moves')).toEqual([]);
    await t.close();
  });

  it('ignores malformed commands and positions outside the map', async () => {
    const t = await createTestApp();
    const [a, b] = await Promise.all(['ws-x', 'ws-y'].map((name) => t.register(name)));
    const [one, two] = await Promise.all([a, b].map((player) => connect(t, player.cookie)));
    for (const client of [one, two]) {
      const state = client.next('map.state');
      client.send({ type: 'map.enter', ...street, x: 10, y: 10 });
      await state;
    }
    const before = one.events.length;
    two.socket.send('not json');
    two.send({ type: 'map.move', x: 'left', y: 1 });
    two.send({ type: 'map.move', x: 99_999, y: 10 });
    two.send({ type: 'subscribe', topic: 'map:entertainment-street:0' });
    // Let the server handle the rejected commands before the clock moves past the move interval.
    await new Promise((resolve) => setTimeout(resolve, 50));
    t.advance(1000);
    const moved = one.next('map.moves');
    two.send({ type: 'map.move', x: 20, y: 20 });
    expect(await moved).toMatchObject({ moves: [{ x: 20, y: 20 }] });
    expect(one.events.slice(before).filter((event) => event.type === 'map.moves')).toHaveLength(1);
    await t.close();
  });
});
