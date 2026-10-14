import { bestGemMove, type GemBattleSnapshot } from '@chibi-town/arcade-games/gem-battle-logic';
import { legalMiniMoves, type MiniSnapshot } from '@chibi-town/arcade-games/mini-games-logic';
import { legalTienPlays } from '@chibi-town/arcade-games/tien-len-logic';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { arcadeTables, playerDocuments } from '@/db/schema';
import { createTestApp } from './test-app.js';

type Snapshot = {
  id: string;
  revision: number;
  status: string;
  turn: number;
  serverTime: number;
  turnEndsAt?: number;
  hand: number[];
  players: { id: string; name: string; outfit: typeof defaultOutfit }[];
  lastSteps?: { revision: number; steps: { actor?: number | string; match?: Snapshot }[] };
};
describe('live table clocks, replay and outfits', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>,
    request = 0;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  const requestId = () => `table-update-${++request}`;

  async function post<T>(cookie: string, url: string, payload: object): Promise<T> {
    const response = await t.app.inject({ method: 'POST', url: `/api${url}`, headers: { cookie }, payload });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<T>();
  }

  async function setup(gameId: ArcadeGameId) {
    const seats = await Promise.all(['update-host', 'update-guest'].map((name) => t.register(name)));
    const mini = ['chess', 'chinese-chess', 'bau-cua', 'slots'].includes(gameId);
    const path = mini ? `/arcade/mini/${gameId}` : `/arcade/${gameId}`;

    const read = async (cookie: string) => {
      const result = await t.app.inject({
        url: `/api${gameId === 'diamonds' ? '/arcade' : path}`,
        headers: { cookie },
      });
      return result.json()[gameId === 'diamonds' ? 'activeBattle' : 'activeMatch'] as Snapshot;
    };

    for (const seat of seats) await post(seat.cookie, `${path}/start`, { gameId, roomId: 0, requestId: requestId() });
    const match = await read(seats[0].cookie);

    const configure = (seat: (typeof seats)[number]) =>
      post(seat.cookie, '/arcade/table/configure', {
        gameId,
        matchId: match.id,
        revision: match.revision,
        stake: 100,
        difficulty: 'medium',
        requestId: requestId(),
      });

    await configure(seats[0]);
    if (gameId === 'bau-cua' || gameId === 'slots') await configure(seats[1]);
    else
      await post(seats[1].cookie, '/arcade/table/member', {
        gameId,
        matchId: match.id,
        revision: match.revision,
        action: { type: 'ready', ready: true },
        requestId: requestId(),
      });

    const play = async (seat: (typeof seats)[number], action: object) => {
      const source = await read(seat.cookie);
      return post<{ match?: Snapshot; battle?: Snapshot; steps: unknown[] }>(seat.cookie, `${path}/play`, {
        gameId,
        matchId: source.id,
        battleId: source.id,
        revision: source.revision,
        action,
        requestId: requestId(),
      });
    };

    const result = await play(seats[0], { type: 'start' });
    return { seats, read, play, path, result };
  }

  it.each(['tien-len', 'phom', 'diamonds', 'chess', 'chinese-chess', 'bau-cua', 'slots'] as const)(
    '%s exposes a server deadline, sanitized outfits and seat-private replay metadata',
    async (gameId) => {
      const { seats, read, play, result } = await setup(gameId);
      const a = await read(seats[0].cookie),
        b = await read(seats[1].cookie);
      for (const snapshot of [a, b]) {
        expect(snapshot.serverTime).toBe(t.clock());
        expect(snapshot.turnEndsAt).toBe(t.clock() + 60_000);
        expect(snapshot.lastSteps?.revision).toBe(snapshot.revision);
        expect(snapshot.players).toHaveLength(2);
        expect(snapshot.players[0].outfit).toEqual(sanitizeOutfit(defaultOutfit));
        expect(JSON.stringify(snapshot)).not.toMatch(/"(?:seed|hands|stock)":/);
      }
      expect(a.lastSteps?.steps).toEqual(result.steps);
      if (gameId === 'tien-len' || gameId === 'phom') {
        expect(b.lastSteps?.steps[0].match?.hand).toEqual(b.hand);
        expect(b.lastSteps?.steps[0].actor).toBe(1);
        expect(a.hand).not.toEqual(b.hand);
      }
      if (gameId === 'diamonds') {
        const move = bestGemMove(a as unknown as GemBattleSnapshot, 'player', 'hard')!;
        const action = await play(seats[0], { type: 'swap', from: move.from, to: move.to });
        const viewer = await read(seats[1].cookie);
        expect(viewer.lastSteps?.revision).toBe(viewer.revision);
        expect(viewer.lastSteps?.steps.length).toBeGreaterThan(0);
        expect(viewer.lastSteps?.steps[0].actor).toBe('bot');
        expect(JSON.stringify(viewer.lastSteps)).not.toMatch(/"seed":/);
        expect(viewer.lastSteps?.steps).toHaveLength(action.steps.length);
      } else if (gameId === 'chess' || gameId === 'chinese-chess') {
        const move = legalMiniMoves(a as unknown as MiniSnapshot)[0];
        await play(seats[0], { type: 'move', ...move });
        const viewer = await read(seats[1].cookie);
        expect(viewer.lastSteps?.revision).toBe(viewer.revision);
        expect(viewer.lastSteps?.steps).toHaveLength(1);
      } else if (gameId === 'tien-len' || gameId === 'phom') {
        const actor = gameId === 'phom' ? 0 : a.turn;
        const mine = actor === 0 ? a : b;
        const move =
          gameId === 'tien-len'
            ? legalTienPlays(mine.hand, undefined, true, Math.min(...a.hand, ...b.hand))[0]
            : undefined;
        await play(
          seats[actor],
          gameId === 'phom' ? { type: 'discard', card: mine.hand[0] } : { type: 'play', cards: move!.cards },
        );
        const viewer = await read(seats[1 - actor].cookie);
        expect(viewer.lastSteps?.revision).toBe(viewer.revision);
        expect(viewer.lastSteps?.steps[0].actor).toBe(1);
        expect(viewer.lastSteps?.steps[0].match?.hand).toEqual(viewer.hand);
        expect(JSON.stringify(viewer.lastSteps)).not.toMatch(/"(?:seed|hands|stock)":/);
      }
      if (gameId === 'bau-cua' || gameId === 'slots') {
        await play(seats[0], gameId === 'bau-cua' ? { type: 'roll', symbol: 0 } : { type: 'spin' });
        const resultView = await read(seats[1].cookie);
        expect(resultView.turnEndsAt).toBeUndefined();
        expect(resultView.lastSteps?.revision).toBe(resultView.revision);
        expect(resultView.lastSteps?.steps).toHaveLength(1);
      }
    },
  );

  it('keeps a Phỏm deadline through drawing on the same turn, then forfeits despite the newer updated_at', async () => {
    const { seats, read, play } = await setup('phom');
    const initial = await read(seats[0].cookie);
    t.advance(30_000);
    await play(seats[0], { type: 'discard', card: initial.hand[0] });
    const receiving = await read(seats[1].cookie);
    expect(receiving.turnEndsAt).toBe(t.clock() + 60_000);
    t.advance(40_000);
    await play(seats[1], { type: 'draw' });
    expect((await read(seats[1].cookie)).turnEndsAt).toBe(receiving.turnEndsAt);
    t.advance(20_001);
    await t.tables.sweep();
    expect(await read(seats[0].cookie)).toBeUndefined();
    expect((await t.sdkFor(seats[1].cookie).getInventory()).farm.coins).toBe(149_900);
    expect((await t.sdkFor(seats[0].cookie).getInventory()).farm.coins).toBe(150_100);
  });

  it('refreshes and sanitizes the saved outfit when an existing seat sits again', async () => {
    const { seats, read, path } = await setup('tien-len');
    const guest = seats[1];
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, guest.player.id));
    const outfit = { ...defaultOutfit, gender: 'female' as const, hair: 'unknown-hair' };
    await t.db
      .update(playerDocuments)
      .set({ document: { ...row.document, outfit } })
      .where(eq(playerDocuments.playerId, guest.player.id));
    await post(guest.cookie, `${path}/start`, { roomId: 0, requestId: requestId() });
    const host = await read(seats[0].cookie);
    expect(host.players[1].outfit).toEqual(sanitizeOutfit(outfit));
    const [table] = await t.db.select().from(arcadeTables);
    expect(table.record.seats[1].outfit).toEqual(sanitizeOutfit(outfit));
  });
});
