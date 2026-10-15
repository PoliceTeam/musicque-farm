import { legalMiniMoves, type MiniAction } from '@chibi-town/arcade-games/mini-games-logic';
import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TURN_LIMIT_MS } from '@/modules/tables/table-service';
import { createTestApp } from './test-app.js';

export function boardTableSuite(gameId: 'chess' | 'chinese-chess') {
  describe(`${gameId} tables of people`, () => {
    let t: Awaited<ReturnType<typeof createTestApp>>;
    let seats: { sdk: GameSdk; id: string }[];
    let request = 0;

    const requestId = () => `r${++request}`;

    const view = async (i: number) => (await seats[i].sdk.getMiniLobby(gameId)).activeMatch!;

    const coins = async () => Promise.all(seats.map(async (s) => (await s.sdk.getInventory()).farm.coins));

    const code = (p: Promise<unknown>) =>
      p.then(
        () => 'resolved',
        (e) => (e instanceof ApiSdkError ? e.code : String(e)),
      );

    async function send(i: number, action: MiniAction) {
      const m = await view(i);
      return seats[i].sdk.playMini({ gameId, requestId: requestId(), matchId: m.id, revision: m.revision, action });
    }

    async function deal(stake = 100) {
      for (const s of seats) await s.sdk.startMiniRoom({ gameId, roomId: 0, tableId: 4, requestId: requestId() });
      let m = await view(0);
      await seats[0].sdk.configureArcadeTable({
        gameId,
        matchId: m.id,
        revision: m.revision,
        requestId: requestId(),
        stake,
        difficulty: 'medium',
      });
      m = await view(1);
      await seats[1].sdk.updateArcadeMember({
        gameId,
        matchId: m.id,
        revision: m.revision,
        requestId: requestId(),
        action: { type: 'ready', ready: true },
      });
      await send(0, { type: 'start' });
    }

    beforeEach(async () => {
      t = await createTestApp();
      seats = await Promise.all(
        [0, 1].map(async (i) => {
          const { cookie, player } = await t.register(`p${i}`);
          return { sdk: t.sdkFor(cookie), id: player.id };
        }),
      );
    });
    afterEach(() => t.close());
    it('plays both sides without bots and settles a full two-player match exactly', async () => {
      await deal();
      for (const i of [0, 1]) {
        const m = await view(i);
        expect(m.side).toBe(i);
        expect(m.players?.[0].id).toBe(seats[i].id);
        expect(JSON.stringify(m)).not.toContain('"seed"');
        await send(i, { type: 'move', ...legalMiniMoves(m)[0] });
        expect((await view(0)).moves).toHaveLength(i + 1);
      }
      await send(1, { type: 'resign' });
      expect(await coins()).toEqual([80_100, 79_900]);
      expect((await view(0)).session?.coinDelta).toBe(100);
      expect((await view(1)).outcome).toBe('loss');
    });
    it('draws by repeated legal positions and returns both stakes unchanged', async () => {
      await deal();
      const cycle =
        gameId === 'chess'
          ? [
              [62, 45],
              [6, 21],
              [45, 62],
              [21, 6],
            ]
          : [
              [82, 63],
              [1, 18],
              [63, 82],
              [18, 1],
            ];
      for (let n = 0; n < 8; n++) {
        const [from, to] = cycle[n % 4];
        await send(n % 2, { type: 'move', from, to });
      }
      expect((await view(0)).outcome).toBe('draw');
      expect((await view(1)).outcome).toBe('draw');
      expect(await coins()).toEqual([80_000, 80_000]);
      expect((await view(1)).session?.coinDelta).toBe(0);
    });
    if (gameId === 'chess')
      it('settles checkmate by black without any automatic white move', async () => {
        await deal();
        const moves = [
          [53, 45],
          [12, 28],
          [54, 38],
          [3, 39],
        ];
        for (const [n, [from, to]] of moves.entries()) await send(n % 2, { type: 'move', from, to });
        expect((await view(1)).outcome).toBe('win');
        expect((await view(1)).reason).toBe('checkmate');
        expect(await coins()).toEqual([79_900, 80_100]);
      });
    it('rejects out-of-turn and illegal moves and returns an identical receipt once', async () => {
      await deal();
      expect(await code(send(1, { type: 'move', from: 0, to: 1 }))).toBe('INVALID_TURN');
      expect(await code(send(0, { type: 'move', from: 0, to: 0 }))).toBe('INVALID_PLAY');
      const m = await view(0);
      const command = {
        gameId,
        requestId: 'retry',
        matchId: m.id,
        revision: m.revision,
        action: { type: 'move' as const, ...legalMiniMoves(m)[0] },
      };
      const first = await seats[0].sdk.playMini(command);
      expect(await seats[0].sdk.playMini(command)).toEqual(first);
      expect(await code(seats[0].sdk.playMini({ ...command, action: { type: 'resign' } }))).toBe('REQUEST_CONFLICT');
      expect((await view(0)).moves).toHaveLength(1);
    });
    it('holds stake and forfeits it when a player leaves in play', async () => {
      await deal(79_990);
      expect((await seats[1].sdk.getMiniLobby(gameId)).availableCoins).toBe(10);
      expect(
        await code(
          seats[1].sdk.execute({
            requestId: requestId(),
            mapInstanceId: 'home',
            type: 'buy-seeds',
            cropId: 'tomato',
            count: 50,
          }),
        ),
      ).not.toBe('resolved');
      const m = await view(1);
      await seats[1].sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: m.revision, requestId: requestId() });
      expect(await coins()).toEqual([159_990, 10]);
      expect((await seats[0].sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
    it('forfeits the current side after turn timeout', async () => {
      await deal();
      await send(0, { type: 'move', ...legalMiniMoves(await view(0))[0] });
      t.advance(TURN_LIMIT_MS + 1);
      await t.tables.sweep();
      expect(await coins()).toEqual([80_100, 79_900]);
      expect((await seats[0].sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
    it('keeps the remaining viewer side and real result names after the host leaves', async () => {
      await deal();
      await send(1, { type: 'resign' });
      const m = await view(0);
      await seats[0].sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: m.revision, requestId: requestId() });
      const guest = await view(1);
      expect(guest.side).toBe(1);
      expect(guest.outcome).toBe('loss');
      expect(guest.session?.coinDelta).toBe(-100);
      expect(guest.players?.map((p) => p.name)).toEqual(['p1', 'p0']);
      const restarted = await seats[1].sdk.startMiniRoom({ gameId, roomId: 0, tableId: 4, requestId: requestId() });
      expect(restarted.side).toBe(0);
      expect(restarted.session?.hostId).toBe(seats[1].id);
      expect(restarted.players).toHaveLength(1);
    });
    it('keeps practice on the individual save with bots', async () => {
      const m = await seats[1].sdk.startMiniRoom({ gameId, roomId: 3, tableId: 0, requestId: requestId() });
      expect(m.players).toBeUndefined();
      expect(m.side).toBeUndefined();
      expect(m.session?.mode).toBe('practice');
      expect((await seats[0].sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
  });
}
