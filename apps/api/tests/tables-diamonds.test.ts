import { bestGemMove, type GemAction } from '@chibi-town/arcade-games/gem-battle-logic';
import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import { tableGames } from '@chibi-town/game-service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TURN_LIMIT_MS } from '@/modules/arcade/tables';
import { createTestApp } from './test-app.js';

describe('Diamonds tables of people', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let seats: GameSdk[];
  let request = 0;

  const requestId = () => `r${++request}`;

  const view = async (i: number) => (await seats[i].getArcadeLobby()).activeBattle!;

  const coins = () => Promise.all(seats.map(async (s) => (await s.getInventory()).farm.coins));

  const code = (p: Promise<unknown>) =>
    p.then(
      () => 'resolved',
      (e) => (e instanceof ApiSdkError ? e.code : String(e)),
    );

  async function send(i: number, action: GemAction) {
    const m = await view(i);
    return seats[i].playDiamond({ requestId: requestId(), battleId: m.id, revision: m.revision, action });
  }

  async function deal(stake = 100) {
    for (const s of seats) await s.startDiamondRoom({ roomId: 0, tableId: 4, requestId: requestId() });
    let m = await view(0);
    await seats[0].configureArcadeTable({
      gameId: 'diamonds',
      matchId: m.id,
      revision: m.revision,
      requestId: requestId(),
      stake,
      difficulty: 'medium',
    });
    m = await view(1);
    await seats[1].updateArcadeMember({
      gameId: 'diamonds',
      matchId: m.id,
      revision: m.revision,
      requestId: requestId(),
      action: { type: 'ready', ready: true },
    });
    await send(0, { type: 'start' });
  }

  beforeEach(async () => {
    t = await createTestApp();
    seats = await Promise.all([0, 1].map(async (i) => t.sdkFor((await t.register(`p${i}`)).cookie)));
  });
  afterEach(() => t.close());
  it('plays a complete two-player battle and settles exact deltas with opposite views and no seed', async () => {
    await deal();
    for (let n = 0; n < 1500; n++) {
      const a = await view(0),
        b = await view(1);
      expect(a.player).toEqual(b.bot);
      expect(a.bot).toEqual(b.player);
      expect(a.turn).toBe(1 - b.turn!);
      for (const m of [a, b]) expect(JSON.stringify(m)).not.toContain('"seed"');
      if (a.status !== 'playing') {
        expect(['won', 'lost']).toContain(a.status);
        expect(b.status).toBe(a.status === 'won' ? 'lost' : 'won');
        expect(await coins()).toEqual(a.status === 'won' ? [80_100, 79_900] : [79_900, 80_100]);
        expect(a.session?.coinDelta).toBe(a.status === 'won' ? 100 : -100);
        const restarted = await seats[0].startDiamondRoom({ roomId: 0, tableId: 4, requestId: requestId() });
        expect(restarted.status).toBe('waiting');
        return;
      }
      const i = a.turn === 0 ? 0 : 1,
        m = i === 0 ? a : b;
      const result = await send(
        i,
        m.player.mana >= 60 ? { type: 'skill' } : { type: 'swap', ...bestGemMove(m, 'player', 'hard')! },
      );
      expect(result.steps.every((s) => s.actor === 'player')).toBe(true);
    }
    throw new Error('battle did not finish');
  });
  it('injects new entropy on every turn that generates gems', async () => {
    await deal();
    const play = vi.spyOn(tableGames.diamonds!, 'play');
    try {
      for (let turn = 0; turn < 3; turn++) {
        const a = await view(0);
        const actor = a.turn === 0 ? 0 : 1;
        const mine = await view(actor);
        await send(actor, { type: 'swap', ...bestGemMove(mine, 'player')! });
        const seed = play.mock.calls[turn][0].seed;
        expect(Array.isArray(seed) && seed.length).toBe(4);
        if (turn) expect(seed).not.toEqual(play.mock.calls[turn - 1][0].seed);
      }
    } finally {
      play.mockRestore();
    }
  });
  it('rejects out-of-turn and illegal actions and replays a receipt once', async () => {
    await deal();
    expect(await code(send(1, { type: 'skill' }))).toBe('INVALID_TURN');
    expect(await code(send(0, { type: 'swap', from: 0, to: 63 }))).toBe('INVALID_MOVE');
    const m = await view(0),
      move = bestGemMove(m, 'player')!;
    const command = {
      requestId: 'retry',
      battleId: m.id,
      revision: m.revision,
      action: { type: 'swap' as const, from: move.from, to: move.to },
    };
    const first = await seats[0].playDiamond(command);
    expect(await seats[0].playDiamond(command)).toEqual(first);
    expect(await code(seats[0].playDiamond({ ...command, action: { type: 'skill' } }))).toBe('REQUEST_CONFLICT');
    expect((await view(0)).moves).toBe(1);
  });
  it('holds stake and forfeits on leave', async () => {
    await deal(79_990);
    expect((await seats[1].getArcadeLobby()).availableCoins).toBe(10);
    expect(
      await code(
        seats[1].execute({
          requestId: requestId(),
          mapInstanceId: 'home',
          type: 'buy-seeds',
          cropId: 'tomato',
          count: 50,
        }),
      ),
    ).not.toBe('resolved');
    const m = await view(1);
    await seats[1].leaveArcadeTable({
      gameId: 'diamonds',
      matchId: m.id,
      revision: m.revision,
      requestId: requestId(),
    });
    expect(await coins()).toEqual([159_990, 10]);
    expect((await seats[0].getArcadeLobby()).activeBattle).toBeUndefined();
  });
  it('forfeits on turn timeout via sweep', async () => {
    await deal();
    t.advance(TURN_LIMIT_MS + 1);
    await t.tables.sweep();
    expect(await coins()).toEqual([79_900, 80_100]);
    expect((await seats[1].getArcadeLobby()).activeBattle).toBeUndefined();
  });
  it('keeps practice on the individual save with bots', async () => {
    const m = await seats[1].startDiamondRoom({ roomId: 3, tableId: 0, requestId: requestId() });
    expect(m.players).toBeUndefined();
    expect(m.turn).toBeUndefined();
    expect(m.session?.mode).toBe('practice');
    expect((await seats[0].getArcadeLobby()).activeBattle).toBeUndefined();
  });
});
