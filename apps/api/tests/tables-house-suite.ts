import type { MiniAction } from '@chibi-town/arcade-games/mini-games-logic';
import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import { tableGames } from '@chibi-town/game-service';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arcadeTables } from '@/infrastructure/database/schema';
import { TURN_LIMIT_MS } from '@/modules/arcade/tables';
import { createTestApp } from './test-app.js';

export function houseTableSuite(gameId: 'bau-cua' | 'slots') {
  describe(`${gameId} tables against the house`, () => {
    let t: Awaited<ReturnType<typeof createTestApp>>;
    let seats: { sdk: GameSdk; id: string }[];
    let request = 0;

    const requestId = () => `r${++request}`;

    const view = async (i: number) => (await seats[i].sdk.getMiniLobby(gameId)).activeMatch!;

    const coins = () => Promise.all(seats.map(async (s) => (await s.sdk.getInventory()).farm.coins));

    const code = (p: Promise<unknown>) =>
      p.then(
        () => 'resolved',
        (e) => (e instanceof ApiSdkError ? e.code : String(e)),
      );

    async function send(i: number, action: MiniAction) {
      const m = await view(i);
      return seats[i].sdk.playMini({ gameId, matchId: m.id, revision: m.revision, requestId: requestId(), action });
    }

    async function configure(i: number, stake: number, choice = i) {
      const m = await view(i);
      return seats[i].sdk.configureArcadeTable({
        gameId,
        matchId: m.id,
        revision: m.revision,
        requestId: requestId(),
        stake,
        difficulty: 'medium',
        ...(gameId === 'bau-cua' ? { choice } : {}),
      });
    }

    async function prepare(count: number, stake = 100) {
      seats = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const { cookie, player } = await t.register(`p${i}`);
          return { sdk: t.sdkFor(cookie), id: player.id };
        }),
      );
      for (const seat of seats) await seat.sdk.startMiniRoom({ gameId, roomId: 0, tableId: 4, requestId: requestId() });
      for (let i = 0; i < seats.length; i++) await configure(i, stake * (i + 1));
    }

    const roll = () => send(0, gameId === 'bau-cua' ? { type: 'roll', symbol: 0 } : { type: 'spin' });

    beforeEach(async () => {
      t = await createTestApp();
    });
    afterEach(() => t.close());
    it.each([1, 2, 3, 4])('settles a full %i-player round with exact independent house deltas', async (count) => {
      await prepare(count);
      const result = await roll();
      const dice = result.match.roll!;
      const slotsMultiplier = dice.every((v) => v === dice[0])
        ? dice[0] === 5
          ? 10
          : 5
        : new Set(dice).size === 2
          ? 2
          : 0;
      const deltas = seats.map(
        (_, i) =>
          100 * (i + 1) * (gameId === 'bau-cua' ? dice.filter((v) => v === i).length || -1 : slotsMultiplier - 1),
      );
      expect(await coins()).toEqual(deltas.map((delta) => 80_000 + delta));
      for (let i = 0; i < count; i++) {
        const m = await view(i);
        expect(m.session?.coinDelta).toBe(deltas[i]);
        expect(m.session?.housePayouts).toEqual(
          seats.map((s, j) => ({ memberId: s.id, delta: deltas[j], coinsAfter: 80_000 + deltas[j] })),
        );
        expect(m.players?.[0].id).toBe(seats[i].id);
        expect(JSON.stringify(m)).not.toContain('"seed"');
        expect((await seats[i].sdk.getMiniLobby(gameId)).availableCoins).toBe(80_000 + deltas[i]);
      }
      await send(0, { type: 'next-round' });
      expect(await coins()).toEqual(deltas.map((delta) => 80_000 + delta));
      expect((await view(0)).session?.members?.every((m) => !m.ready)).toBe(true);
      expect(await code(roll())).toBe('NOT_ALLOWED');
    });
    it('injects fresh 128-bit entropy for every roll/spin and next-round', async () => {
      await prepare(1);

      const readSeed = async () =>
        (await t.db.select().from(arcadeTables).where(eq(arcadeTables.gameId, gameId)))[0].record.match as {
          seed: unknown;
        };

      const first = structuredClone((await readSeed()).seed);
      const play = vi.spyOn(tableGames[gameId]!, 'play');
      try {
        const result = await roll();
        const rollSeed = play.mock.calls[0][0].seed;
        expect(Array.isArray(rollSeed) && rollSeed.length).toBe(4);
        expect(rollSeed).not.toEqual(first);
        expect(JSON.stringify(result)).not.toContain('"seed"');
        const afterRoll = structuredClone((await readSeed()).seed);
        await send(0, { type: 'next-round' });
        expect((await readSeed()).seed).not.toEqual(afterRoll);
        await configure(0, 100);
        await roll();
        expect(play.mock.calls[2][0].seed).not.toEqual(rollSeed);
      } finally {
        play.mockRestore();
      }
    });
    it('lets every member set only their own bet, checks readiness and rejects illegal/out-of-turn actions', async () => {
      await prepare(2);
      const before = (await view(0)).session!;
      await configure(1, 350, 5);
      expect((await view(0)).session?.stake).toBe(100);
      expect((await view(0)).session?.members?.[0]).toEqual(before.members![0]);
      expect((await view(0)).session?.members?.[1]).toMatchObject({ stake: 350, ready: true });
      expect(await code(configure(1, 160_000))).toBe('INSUFFICIENT_COINS');
      const m = await view(1);
      expect(
        await code(
          seats[1].sdk.configureArcadeTable({
            gameId,
            matchId: m.id,
            revision: m.revision,
            requestId: requestId(),
            stake: 100,
            difficulty: 'medium',
            bets: [{ memberId: seats[0].id, stake: 2 }],
          }),
        ),
      ).toBe('NOT_ALLOWED');
      expect(await code(send(1, gameId === 'bau-cua' ? { type: 'roll', symbol: 5 } : { type: 'spin' }))).toBe(
        'NOT_ALLOWED',
      );
      expect(await code(send(0, { type: 'move', from: 0, to: 1 }))).toBe('INVALID_TURN');
      if (gameId === 'bau-cua') expect(await code(send(0, { type: 'roll', symbol: 5 }))).toBe('INVALID_PLAY');
      const ready = await view(1);
      await seats[1].sdk.updateArcadeMember({
        gameId,
        matchId: ready.id,
        revision: ready.revision,
        requestId: requestId(),
        action: { type: 'ready', ready: false },
      });
      expect(await code(roll())).toBe('NOT_ALLOWED');
    });
    it('returns exactly the same settled result on retry, without paying twice', async () => {
      await prepare(3);
      const m = await view(0);
      const command = {
        gameId,
        matchId: m.id,
        revision: m.revision,
        requestId: 'retry',
        action: gameId === 'bau-cua' ? { type: 'roll' as const, symbol: 0 } : { type: 'spin' as const },
      };
      const first = await seats[0].sdk.playMini(command),
        balances = await coins();
      expect(await seats[0].sdk.playMini(command)).toEqual(first);
      expect(await coins()).toEqual(balances);
      expect(await code(seats[0].sdk.playMini({ ...command, action: { type: 'next-round' } }))).toBe(
        'REQUEST_CONFLICT',
      );
    });
    it('holds each stake in play and forfeits the leaver own stake to others', async () => {
      await prepare(3, 200);
      await send(0, { type: 'start' });
      expect((await seats[1].sdk.getMiniLobby(gameId)).availableCoins).toBe(79_600);
      const m = await view(1);
      await seats[1].sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: m.revision, requestId: requestId() });
      expect(await coins()).toEqual([80_200, 79_600, 80_200]);
      expect((await seats[0].sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
    it('forfeits the host own stake when the turn times out via sweep', async () => {
      await prepare(3);
      await send(0, { type: 'start' });
      t.advance(TURN_LIMIT_MS + 1);
      await t.tables.sweep();
      expect(await coins()).toEqual([79_900, 80_050, 80_050]);
      expect((await seats[1].sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
    it('hands the next round to a remaining member without reusing departed bets', async () => {
      await prepare(2);
      await roll();
      const before = await coins(),
        host = await view(0);
      await seats[0].sdk.leaveArcadeTable({
        gameId,
        matchId: host.id,
        revision: host.revision,
        requestId: requestId(),
      });
      expect((await view(1)).session?.hostId).toBe(seats[1].id);
      expect((await view(1)).players?.map((p) => p.name)).toEqual(['p1', 'p0']);
      await send(1, { type: 'next-round' });
      expect((await view(1)).players?.map((p) => p.name)).toEqual(['p1']);
      await configure(1, 250, 5);
      const result = await send(1, gameId === 'bau-cua' ? { type: 'roll', symbol: 5 } : { type: 'spin' });
      const hits = result.match.roll!.filter((v) => v === 5).length;
      const delta = gameId === 'bau-cua' ? 250 * (hits || -1) : 250 * (result.match.multiplier! - 1);
      expect(await coins()).toEqual([before[0], before[1] + delta]);
      expect(result.match.session?.housePayouts).toHaveLength(1);
    });
    it('keeps practice private on the player save', async () => {
      const { cookie } = await t.register('solo');
      const m = await t.sdkFor(cookie).startMiniRoom({ gameId, roomId: 3, tableId: 0, requestId: requestId() });
      expect(m.session?.mode).toBe('practice');
      expect(m.players).toBeUndefined();
    });
  });
}
