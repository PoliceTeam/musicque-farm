import { legalTienPlays, type TienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDLE_LIMIT_MS, TURN_LIMIT_MS } from '@/modules/tables/table-service';
import { createTestApp } from './test-app.js';

type Seat = { sdk: GameSdk; id: string; name: string; cookie: string };

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error) => (error instanceof ApiSdkError ? error.code : String(error)),
  );

let request = 0;

const requestId = () => `r${++request}`;

describe('Tiến lên tables of people', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  async function players(count: number, prefix = 'p'): Promise<Seat[]> {
    return Promise.all(
      Array.from({ length: count }, async (_, index) => {
        const { cookie, player } = await t.register(`${prefix}${index}`);
        return { sdk: t.sdkFor(cookie), id: player.id, name: player.name, cookie };
      }),
    );
  }

  const view = async (seat: Seat) => (await seat.sdk.getTienLobby()).activeMatch!;

  const coins = async (seat: Seat) => (await seat.sdk.getInventory()).farm.coins;

  /** Everyone sits at room 0 table 4, the host sets the stake, the others confirm, the host deals. */
  async function deal(seats: Seat[], stake = 100) {
    for (const seat of seats) await seat.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    const host = await view(seats[0]);
    await seats[0].sdk.configureArcadeTable({
      gameId: 'tien-len',
      matchId: host.id,
      revision: host.revision,
      requestId: requestId(),
      stake,
      difficulty: 'medium',
    });
    for (const seat of seats.slice(1)) {
      const mine = await view(seat);
      await seat.sdk.updateArcadeMember({
        gameId: 'tien-len',
        matchId: mine.id,
        revision: mine.revision,
        requestId: requestId(),
        action: { type: 'ready', ready: true },
      });
    }
    const ready = await view(seats[0]);
    return seats[0].sdk.playTien({
      requestId: requestId(),
      matchId: ready.id,
      revision: ready.revision,
      action: { type: 'start' },
    });
  }

  /** Each seat plays its first legal combination, or passes, until the match ends. */
  async function playOut(seats: Seat[]) {
    for (let turns = 0; turns < 400; turns++) {
      const views = await Promise.all(seats.map(view));
      if (views[0].status === 'finished') return views;
      const actor = views.findIndex((snapshot) => snapshot.turn === 0);
      expect(actor).toBeGreaterThanOrEqual(0);
      const mine = views[actor];
      const move = legalTienPlays(mine.hand, mine.pile, mine.opening, mine.openingCard ?? 0)[0];
      await seats[actor].sdk.playTien({
        requestId: requestId(),
        matchId: mine.id,
        revision: mine.revision,
        action: move ? { type: 'play', cards: move.cards } : { type: 'pass' },
      });
    }
    throw new Error('match did not finish');
  }

  it('opens a table for the first player and shows it to the channel as waiting', async () => {
    const [host, guest, outsider] = await players(3);
    const opened = (await host.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() })) as TienSnapshot;
    expect(opened.session).toMatchObject({ hostId: host.id, mode: 'wager', configured: false });
    expect(opened.players).toEqual([
      { id: host.id, name: 'p0', username: 'p0_', outfit: (await host.sdk.getPlayer()).outfit },
    ]);
    const lobby = await guest.sdk.getTienLobby();
    expect(lobby.rooms[0].tables[4]).toMatchObject({ occupants: 1, status: 'waiting', capacity: 4 });
    expect(lobby.rooms[0].tables[5]).toMatchObject({ occupants: 0, status: 'empty' });
    expect(lobby.activeMatch).toBeUndefined();

    await outsider.sdk.joinMapChannel({ regionId: 'fun', mapId: 'entertainment-street', channelId: 7 });
    expect((await outsider.sdk.getTienLobby()).rooms[0].tables[4]).toMatchObject({ occupants: 0, status: 'empty' });
    const elsewhere = (await outsider.sdk.startTienRoom({
      roomId: 0,
      tableId: 4,
      requestId: requestId(),
    })) as TienSnapshot;
    expect(elsewhere.id).not.toBe(opened.id);
  });

  it('seats each player as seat 0 of their own view and hides the other hands', async () => {
    const seats = await players(3);
    await deal(seats);
    const views = await Promise.all(seats.map(view));
    const hands = views.map((snapshot) => snapshot.hand);
    expect(hands.every((hand) => hand.length === 13)).toBe(true);
    expect(new Set(hands.flat()).size).toBe(39);
    for (const [index, snapshot] of views.entries()) {
      expect(snapshot.players?.map((player) => player.name)).toEqual(
        [0, 1, 2].map((offset) => `p${(index + offset) % 3}`),
      );
      expect(snapshot.counts).toEqual([13, 13, 13, 0]);
      const raw = JSON.stringify(snapshot);
      expect(raw).not.toContain('"hands"');
      expect(raw).not.toContain('"seed"');
      expect(raw).not.toContain('"undealt"');
    }
    // Exactly one player sees the turn on their own seat, and they hold the opening card.
    const opener = views.filter((snapshot) => snapshot.turn === 0);
    expect(opener).toHaveLength(1);
    expect(opener[0].hand).toContain(opener[0].openingCard);
  });

  it.each([2, 3, 4])('plays a whole %i-player match and settles the pool between the players', async (count) => {
    const seats = await players(count);
    const before = await Promise.all(seats.map(coins));
    await deal(seats, 100);
    const views = await playOut(seats);
    const after = await Promise.all(seats.map(coins));
    const deltas = after.map((value, index) => value - before[index]);
    expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBe(0);
    expect([...deltas].sort((a, b) => a - b)).toEqual(
      count === 2 ? [-100, 100] : count === 3 ? [-100, -40, 140] : [-100, -100, 60, 140],
    );
    for (const [index, snapshot] of views.entries()) {
      expect(snapshot.session?.settled).toBe(true);
      expect(snapshot.session?.coinDelta).toBe(deltas[index]);
      expect(snapshot.placements).toHaveLength(2);
    }
    const winner = views.findIndex((snapshot) => snapshot.winner === 0);
    expect(deltas[winner]).toBe(Math.max(...deltas));
    expect((await seats[winner].sdk.getTienLobby()).wins).toBe(1);
  });

  it('rejects play out of turn, cards not held, and a stale revision', async () => {
    const seats = await players(2);
    await deal(seats);
    const views = await Promise.all(seats.map(view));
    const actor = views.findIndex((snapshot) => snapshot.turn === 0);
    const waiting = 1 - actor;

    const play = (seat: number, cards: number[], revision = views[seat].revision) =>
      code(
        seats[seat].sdk.playTien({
          requestId: requestId(),
          matchId: views[seat].id,
          revision,
          action: { type: 'play', cards },
        }),
      );

    expect(await play(waiting, [views[waiting].hand[0]])).toBe('INVALID_TURN');
    expect(await play(actor, [views[waiting].hand[0]])).toBe('INVALID_PLAY');
    expect(await play(actor, [views[actor].openingCard!], views[actor].revision - 1)).toBe('REQUEST_CONFLICT');
    expect(await play(actor, [views[actor].openingCard!])).toBe('resolved');
  });

  it('answers a retried command once and refuses the same id with other content', async () => {
    const seats = await players(2);
    await deal(seats);
    const views = await Promise.all(seats.map(view));
    const actor = views.findIndex((snapshot) => snapshot.turn === 0);
    const command = {
      requestId: 'same-id',
      matchId: views[actor].id,
      revision: views[actor].revision,
      action: { type: 'play' as const, cards: [views[actor].openingCard!] },
    };
    const first = await seats[actor].sdk.playTien(command);
    expect(await seats[actor].sdk.playTien(command)).toEqual(first);
    expect(await code(seats[actor].sdk.playTien({ ...command, action: { type: 'pass' } }))).toBe('REQUEST_CONFLICT');
    expect((await view(seats[actor])).revision).toBe(first.match.revision);
  });

  it('needs a stake, every player ready and at least two players before the host can deal', async () => {
    const [host, guest, third] = await players(3);
    await host.sdk.startTienRoom({ roomId: 1, tableId: 0, requestId: requestId() });

    const start = async (seat: Seat) => {
      const mine = await view(seat);
      return code(
        seat.sdk.playTien({
          requestId: requestId(),
          matchId: mine.id,
          revision: mine.revision,
          action: { type: 'start' },
        }),
      );
    };

    const configure = async (seat: Seat, stake: number) => {
      const mine = await view(seat);
      return code(
        seat.sdk.configureArcadeTable({
          gameId: 'tien-len',
          matchId: mine.id,
          revision: mine.revision,
          requestId: requestId(),
          stake,
          difficulty: 'medium',
        }),
      );
    };

    const ready = async (seat: Seat, value = true) => {
      const mine = await view(seat);
      return code(
        seat.sdk.updateArcadeMember({
          gameId: 'tien-len',
          matchId: mine.id,
          revision: mine.revision,
          requestId: requestId(),
          action: { type: 'ready', ready: value },
        }),
      );
    };

    expect(await start(host)).toBe('NOT_ALLOWED');
    expect(await configure(host, 0)).toBe('INSUFFICIENT_COINS');
    expect(await configure(host, 160_000)).toBe('INSUFFICIENT_COINS');
    expect(await configure(host, 500)).toBe('resolved');
    expect(await start(host)).toBe('NOT_ALLOWED');

    await guest.sdk.startTienRoom({ roomId: 1, tableId: 0, requestId: requestId() });
    expect(await configure(guest, 5)).toBe('NOT_ALLOWED');
    expect(await start(guest)).toBe('NOT_ALLOWED');
    expect(await start(host)).toBe('NOT_ALLOWED');
    expect(await ready(guest)).toBe('resolved');

    // A new stake is a new agreement: the guest has to confirm again.
    expect(await configure(host, 800)).toBe('resolved');
    expect((await view(guest)).session?.members).toEqual([
      { id: host.id, ready: true },
      { id: guest.id, ready: false },
    ]);
    expect(await start(host)).toBe('NOT_ALLOWED');
    expect(await ready(guest)).toBe('resolved');

    // A late joiner blocks the deal until they confirm as well.
    await third.sdk.startTienRoom({ roomId: 1, tableId: 0, requestId: requestId() });
    expect(await start(host)).toBe('NOT_ALLOWED');
    expect(await ready(third)).toBe('resolved');
    expect(await start(host)).toBe('resolved');
    expect((await view(third)).counts).toEqual([13, 13, 13, 0]);
  });

  it('holds the stake while the match runs, so it cannot be spent or wagered twice', async () => {
    const seats = await players(2);
    await deal(seats, 149_990);
    expect((await seats[0].sdk.getTienLobby()).availableCoins).toBe(10);
    const buy = await code(
      seats[0].sdk.execute({
        requestId: requestId(),
        mapInstanceId: 'home',
        type: 'buy-seeds',
        cropId: 'tomato',
        count: 50,
      }),
    );
    expect(buy).not.toBe('resolved');
    expect(await coins(seats[0])).toBe(150_000);
    expect(await code(seats[0].sdk.startTienRoom({ roomId: 0, tableId: 9, requestId: requestId() }))).toBe(
      'MATCH_IN_PROGRESS',
    );
    expect(await code(seats[0].sdk.startTienRoom({ roomId: 3, tableId: 0, requestId: requestId() }))).toBe(
      'MATCH_IN_PROGRESS',
    );
  });

  it('gives the stake of a player who walks out to those who stayed and frees the table', async () => {
    const seats = await players(3);
    await deal(seats, 100);
    const quitter = await view(seats[1]);
    const left = await seats[1].sdk.leaveArcadeTable({
      gameId: 'tien-len',
      matchId: quitter.id,
      revision: quitter.revision,
      requestId: requestId(),
    });
    expect(left).toMatchObject({ coins: 149_900, coinDelta: -100 });
    expect(await Promise.all(seats.map(coins))).toEqual([150_050, 149_900, 150_050]);
    for (const seat of seats) {
      const lobby = await seat.sdk.getTienLobby();
      expect(lobby.activeMatch).toBeUndefined();
      expect(lobby.availableCoins).toBe(await coins(seat));
      expect(lobby.rooms[0].tables[4]).toMatchObject({ occupants: 0, status: 'empty' });
    }
  });

  it('lets players leave a waiting table for free and hands the table to the next player', async () => {
    const [host, guest] = await players(2);
    await host.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    await guest.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    const mine = await view(host);
    const left = await host.sdk.leaveArcadeTable({
      gameId: 'tien-len',
      matchId: mine.id,
      revision: mine.revision,
      requestId: requestId(),
    });
    expect(left.coinDelta).toBe(0);
    const remaining = await view(guest);
    expect(remaining.session?.hostId).toBe(guest.id);
    expect(remaining.players).toEqual([
      { id: guest.id, name: 'p1', username: 'p1_', outfit: (await guest.sdk.getPlayer()).outfit },
    ]);
    await guest.sdk.leaveArcadeTable({
      gameId: 'tien-len',
      matchId: remaining.id,
      revision: remaining.revision,
      requestId: requestId(),
    });
    expect((await host.sdk.getTienLobby()).rooms[0].tables[4].status).toBe('empty');
  });

  it('refuses a fifth player and anyone arriving after the deal', async () => {
    const seats = await players(5);
    for (const seat of seats.slice(0, 4))
      await seat.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    expect(await code(seats[4].sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() }))).toBe(
      'NOT_ALLOWED',
    );
    await deal(seats.slice(0, 4));
    expect(await code(seats[4].sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() }))).toBe(
      'MATCH_IN_PROGRESS',
    );
    expect((await seats[4].sdk.getTienLobby()).rooms[0].tables[4]).toMatchObject({ occupants: 4, status: 'playing' });
  });

  it('keeps the practice room on the player own save with bots', async () => {
    const [solo] = await players(1);
    const practice = await solo.sdk.startTienRoom({ roomId: 3, tableId: 2, requestId: requestId() });
    expect(practice.session?.mode).toBe('practice');
    expect((practice as TienSnapshot).players).toBeUndefined();
    expect(await code(solo.sdk.startTienRoom({ roomId: 0, tableId: 0, requestId: requestId() }))).toBe(
      'MATCH_IN_PROGRESS',
    );
  });

  it('forfeits the seat that lets its turn run out and closes tables nobody uses', async () => {
    const seats = await players(2);
    await deal(seats, 100);
    const views = await Promise.all(seats.map(view));
    const slow = views.findIndex((snapshot) => snapshot.turn === 0);
    t.advance(TURN_LIMIT_MS - 1000);
    await t.tables.sweep();
    expect((await view(seats[0])).status).toBe('playing');
    t.advance(2000);
    await t.tables.sweep();
    expect(await coins(seats[slow])).toBe(149_900);
    expect(await coins(seats[1 - slow])).toBe(150_100);
    expect((await seats[0].sdk.getTienLobby()).activeMatch).toBeUndefined();

    const [idle] = await players(1, 'idle');
    await idle.sdk.startTienRoom({ roomId: 2, tableId: 2, requestId: requestId() });
    t.advance(IDLE_LIMIT_MS - 1000);
    await t.tables.sweep();
    expect((await idle.sdk.getTienLobby()).activeMatch).toBeDefined();
    t.advance(2000);
    await t.tables.sweep();
    expect((await idle.sdk.getTienLobby()).activeMatch).toBeUndefined();
  });

  it('frees a waiting seat when its player disconnects and stays away, but never a match in play', async () => {
    const [host, guest] = await players(2);

    const connect = (seat: Seat) =>
      t.app.injectWS('/api/ws', { headers: { cookie: seat.cookie, origin: 'http://game.test' } });

    const away = () => new Promise((resolve) => setTimeout(resolve, 150));

    await host.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    await guest.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    // A reload: the old socket closes while a new one is already open.
    const first = await connect(guest);
    const second = await connect(guest);
    first.terminate();
    await away();
    expect((await view(host)).players).toHaveLength(2);
    second.terminate();
    await away();
    expect((await view(host)).players).toHaveLength(1);
    expect((await guest.sdk.getTienLobby()).activeMatch).toBeUndefined();

    const seats = await players(2, 'd');
    await seats[0].sdk.startTienRoom({ roomId: 0, tableId: 8, requestId: requestId() });
    await seats[1].sdk.startTienRoom({ roomId: 0, tableId: 8, requestId: requestId() });
    const waiting = await view(seats[0]);
    await seats[0].sdk.configureArcadeTable({
      gameId: 'tien-len',
      matchId: waiting.id,
      revision: waiting.revision,
      requestId: requestId(),
      stake: 50,
      difficulty: 'medium',
    });
    const joined = await view(seats[1]);
    await seats[1].sdk.updateArcadeMember({
      gameId: 'tien-len',
      matchId: joined.id,
      revision: joined.revision,
      requestId: requestId(),
      action: { type: 'ready', ready: true },
    });
    const ready = await view(seats[0]);
    await seats[0].sdk.playTien({
      requestId: requestId(),
      matchId: ready.id,
      revision: ready.revision,
      action: { type: 'start' },
    });
    (await connect(seats[1])).terminate();
    await away();
    expect((await view(seats[0])).status).toBe('playing');
    expect(await coins(seats[1])).toBe(150_000);
  });

  it('tells the other players and the lobby when the table changes', async () => {
    const [host, guest, watcher] = await players(3);

    const connect = async (seat: Seat) => {
      const socket = await t.app.injectWS('/api/ws', { headers: { cookie: seat.cookie, origin: 'http://game.test' } });
      const events: { type: string; gameId?: string }[] = [];
      socket.on('message', (data) => events.push(JSON.parse(String(data))));
      return { socket, events };
    };

    const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

    const [hostSocket, watcherSocket] = await Promise.all([connect(host), connect(watcher)]);
    watcherSocket.socket.send(JSON.stringify({ type: 'lobby.watch', gameId: 'tien-len' }));
    await settle();
    await host.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    await guest.sdk.startTienRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    await settle();
    expect(watcherSocket.events).toEqual([
      { type: 'lobby', gameId: 'tien-len' },
      { type: 'lobby', gameId: 'tien-len' },
    ]);
    expect(hostSocket.events.filter((event) => event.type === 'match')).toHaveLength(2);
  });
});
