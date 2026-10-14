/**
 * Simulation audit of Bầu cua and Xèng (slots): RNG quality, return-to-player, wallet accounting through the
 * local SDK and exploit attempts. Passing tests record behaviour that matches docs/arcade.md; every `it.fails`
 * reproduces a defect and flips to a normal failure (prompting removal of `.fails`) once the defect is fixed.
 */
import { createLocalDocument, createLocalSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import {
  createMiniMatch,
  isMiniMatch,
  isMiniSnapshot,
  type MiniMatch,
  type MiniSnapshot,
  miniCoinDelta,
  miniMemberCoinDeltas,
  playMiniAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import { describe, expect, it, vi } from 'vitest';

type ChanceId = 'bau-cua' | 'slots';
const CHANCE: ChanceId[] = ['bau-cua', 'slots'];
const HOST = 'local-player';
const BOTS = ['local-bot-1', 'local-bot-2', 'local-bot-3'];

/** Independent PRNG for the simulated player's decisions (not the engine's LCG). */
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Documented Xèng table: pair 2×, triple 5×, triple diamond (face 5) 10×, otherwise 0×. */
function slotsMultiplier(roll: number[]) {
  const distinct = new Set(roll).size;
  return distinct === 1 ? (roll[0] === 5 ? 10 : 5) : distinct === 2 ? 2 : 0;
}

/** Documented Bầu cua table: k hits win k stakes, no hit loses the stake. */
function bauDelta(roll: number[], choice: number, stake: number) {
  const hits = roll.filter((v) => v === choice).length;
  return hits ? stake * hits : -stake;
}

const chi = (observed: number[], expected: number) =>
  observed.reduce((sum, value) => sum + (value - expected) ** 2 / expected, 0);

const wager = (stake: number) => ({
  hostId: HOST,
  mode: 'wager' as const,
  stake,
  difficulty: 'medium' as const,
  configured: true,
});

describe('engine: 240,000 seeded rounds per game', () => {
  const ROUNDS = 240_000;
  const SEEDS = [1, 20261014, 4294967295];
  for (const gameId of CHANCE)
    it(`${gameId}: uniform faces, independent dice and documented return-to-player`, () => {
      const faces = [0, 1, 2].map(() => Array<number>(6).fill(0));
      const triples = Array<number>(216).fill(0);
      const sameDieNextRound = Array<number>(36).fill(0);
      const lastDieToNextFirst = Array<number>(36).fill(0);
      const multipliers: Record<number, number> = {};
      let net = 0,
        wins = 0,
        rounds = 0;
      for (const seed of SEEDS) {
        let match: MiniMatch = createMiniMatch(gameId, 'audit', 0, seed);
        match.session = wager(1);
        let previous: number[] | undefined;
        for (let i = 0; i < ROUNDS / SEEDS.length; i++) {
          const choice = i % 6;
          const played = playMiniAction(
            match,
            gameId === 'bau-cua' ? { type: 'roll', symbol: choice } : { type: 'spin' },
          );
          match = played.state;
          const roll = match.roll!;
          const expectedMultiplier =
            gameId === 'slots' ? slotsMultiplier(roll) : roll.filter((v) => v === choice).length;
          if (match.multiplier !== expectedMultiplier)
            throw new Error(`multiplier mismatch ${roll} ${match.multiplier}`);
          const expectedDelta = gameId === 'slots' ? expectedMultiplier - 1 : bauDelta(roll, choice, 1);
          if (miniCoinDelta(match) !== expectedDelta) throw new Error(`delta mismatch ${roll}`);
          if ((match.outcome === 'win') !== expectedDelta > 0 || match.status !== 'finished')
            throw new Error(`outcome mismatch ${roll} ${match.outcome}`);
          roll.forEach((value, die) => {
            faces[die][value]++;
          });
          triples[roll[0] * 36 + roll[1] * 6 + roll[2]]++;
          if (previous) {
            sameDieNextRound[previous[0] * 6 + roll[0]]++;
            lastDieToNextFirst[previous[2] * 6 + roll[0]]++;
          }
          previous = roll;
          net += expectedDelta;
          if (expectedDelta > 0) wins++;
          multipliers[match.multiplier!] = (multipliers[match.multiplier!] ?? 0) + 1;
          rounds++;
          match = playMiniAction(match, { type: 'next-round' }).state;
          match.session = wager(1);
        }
      }
      expect(rounds).toBe(ROUNDS);
      // chi-square critical values at p = 0.001: 5 df 20.5, 35 df 66.6, 215 df 283.
      for (const die of faces) expect(chi(die, ROUNDS / 6)).toBeLessThan(20.5);
      expect(chi(triples, ROUNDS / 216)).toBeLessThan(283);
      expect(chi(sameDieNextRound, (ROUNDS - SEEDS.length) / 36)).toBeLessThan(66.6);
      expect(chi(lastDieToNextFirst, (ROUNDS - SEEDS.length) / 36)).toBeLessThan(66.6);
      for (const die of faces) for (const count of die) expect(Math.abs(count / ROUNDS - 1 / 6)).toBeLessThan(0.003);
      const rtp = 1 + net / ROUNDS;
      console.log(
        `chance ${gameId} engine rounds=${rounds} RTP=${(rtp * 100).toFixed(4)}% win=${((wins / rounds) * 100).toFixed(4)}%`,
      );
      if (gameId === 'bau-cua') {
        // P(k hits) = C(3,k) 5^(3-k) / 216 → EV = (75 + 2·15 + 3·1 − 125) / 216 = −17/216.
        expect(Math.abs(rtp - (1 - 17 / 216))).toBeLessThan(0.008);
        expect(Math.abs(wins / ROUNDS - 91 / 216)).toBeLessThan(0.004);
        expect(Math.abs(multipliers[3] / ROUNDS - 1 / 216)).toBeLessThan(0.0006);
      } else {
        // 90 pairs ×2 + 5 triples ×5 + 1 diamond triple ×10 = 215 / 216.
        expect(Math.abs(rtp - 215 / 216)).toBeLessThan(0.01);
        expect(Math.abs(wins / ROUNDS - 96 / 216)).toBeLessThan(0.004);
        expect(Math.abs(multipliers[2] / ROUNDS - 90 / 216)).toBeLessThan(0.004);
        expect(Math.abs(multipliers[5] / ROUNDS - 5 / 216)).toBeLessThan(0.0012);
        expect(Math.abs(multipliers[10] / ROUNDS - 1 / 216)).toBeLessThan(0.0006);
      }
    });

  it('every engine state survives a JSON reload through the stored-match validators', () => {
    for (const gameId of CHANCE) {
      let match: MiniMatch = createMiniMatch(gameId, 'reload', 0, 99);
      match.session = wager(5);
      for (let i = 0; i < 300; i++) {
        const played = playMiniAction(match, gameId === 'bau-cua' ? { type: 'roll', symbol: i % 6 } : { type: 'spin' });
        expect(isMiniMatch(JSON.parse(JSON.stringify(played.state)))).toBe(true);
        expect(played.result.steps.every((step) => isMiniSnapshot(JSON.parse(JSON.stringify(step))))).toBe(true);
        match = playMiniAction(played.state, { type: 'next-round' }).state;
        expect(isMiniMatch(JSON.parse(JSON.stringify(match)))).toBe(true);
        match.session = wager(5);
      }
    }
  });

  it('rejects malformed engine actions without mutating the match', () => {
    const match = createMiniMatch('bau-cua', 'bad', 0, 7);
    match.session = wager(1);
    const frozen = JSON.stringify(match);
    for (const symbol of [-1, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => playMiniAction(match, { type: 'roll', symbol })).toThrow('INVALID_PLAY');
    expect(() => playMiniAction(match, { type: 'spin' })).toThrow('INVALID_PLAY');
    expect(() => playMiniAction(match, { type: 'next-round' })).toThrow('INVALID_PLAY');
    expect(JSON.stringify(match)).toBe(frozen);
    const done = playMiniAction(match, { type: 'roll', symbol: 0 }).state;
    expect(() => playMiniAction(done, { type: 'roll', symbol: 0 })).toThrow('MATCH_FINISHED');
  });
});

describe('engine: seed handling', () => {
  const firstRoll = (seed: number) => {
    const match = createMiniMatch('slots', 'seed', 0, seed);
    match.session = wager(1);
    return playMiniAction(match, { type: 'spin' }).state.roll!;
  };

  const NOW = 1_791_000_000_000;

  // DEFECT: the table seed is the raw millisecond clock and the first output of the LCG is seed·1664525 + c, so a
  // one millisecond step only moves the first die by 1664525 / 2^32 = 0.04 % of its range.
  it('tables opened one millisecond apart do not share their first die', () => {
    let same = 0;
    for (let i = 0; i < 20_000; i++) if (firstRoll(NOW + i)[0] === firstRoll(NOW + i + 1)[0]) same++;
    // Independent seeds would agree 1/6 of the time; measured 99.77 %.
    expect(same / 20_000).toBeLessThan(0.25);
  });
});

/** Drives the local SDK the way mini-game.tsx does: configure (stake + ready) → roll/spin → next-round. */
function table(gameId: ChanceId, coins: number, clock: () => number = () => 42) {
  const document = createLocalDocument();
  document.farm.coins = coins;
  const repository = createMemoryRepository(document);
  const sdk = createLocalSdk({ repository, clock, random: mulberry(8675309) });
  let counter = 0;

  const id = (prefix: string) => `${prefix}-${counter++}`;

  const ledger = () =>
    repository.transaction((d) => ({
      coins: d.farm.coins,
      bots: { ...d.arcadeBotCoins },
      wins: d.mini?.[gameId]?.wins ?? 0,
    }));

  let match!: MiniSnapshot;
  let revision = 0;
  return {
    sdk,
    repository,
    ledger,
    id,

    get match() {
      return match;
    },

    get revision() {
      return revision;
    },

    async open(roomId = 0, tableId = 0) {
      match = await sdk.startMiniRoom({ gameId, roomId, tableId, requestId: id('open') });
      revision = match.revision;
      return match;
    },

    async configure(
      stake: number,
      extra: { choice?: number; bets?: { memberId: string; stake: number; choice?: number }[] } = {},
    ) {
      const result = await sdk.configureArcadeTable({
        gameId,
        matchId: match.id,
        revision,
        requestId: id('configure'),
        stake,
        difficulty: 'medium',
        ...extra,
      });
      revision++;
      return result;
    },

    async play(symbol = 0) {
      const result = await sdk.playMini({
        gameId,
        matchId: match.id,
        revision,
        requestId: id('play'),
        action: gameId === 'bau-cua' ? { type: 'roll', symbol } : { type: 'spin' },
      });
      revision++;
      match = result.match;
      return result;
    },

    async next() {
      const result = await sdk.playMini({
        gameId,
        matchId: match.id,
        revision,
        requestId: id('next'),
        action: { type: 'next-round' },
      });
      revision++;
      match = result.match;
      return result;
    },
  };
}

const smallBotBets = (random: () => number) =>
  BOTS.map((memberId) => ({ memberId, stake: 1 + Math.floor(random() * 3), choice: Math.floor(random() * 6) }));

describe('SDK wallet accounting in wager rooms', () => {
  for (const gameId of CHANCE)
    it(`${gameId}: 3,000 full rounds settle exactly the documented delta for the host and every bot`, {
      timeout: 30000,
    }, async () => {
      const random = mulberry(gameId === 'slots' ? 11 : 12);
      const t = table(gameId, 1_000_000, () => 1_791_000_123_456);
      await t.open(1, 4);
      let before = await t.ledger();
      expect(before.bots).toEqual({ 'local-bot-1': 10000, 'local-bot-2': 10000, 'local-bot-3': 10000 });
      let staked = 0,
        returned = 0,
        wins = 0;
      for (let round = 0; round < 3000; round++) {
        const stake = 1 + Math.floor(random() * 200);
        const choice = Math.floor(random() * 6);
        const bets = smallBotBets(random);
        await t.configure(stake, { ...(gameId === 'bau-cua' ? { choice } : {}), bets });
        const untouched = await t.ledger();
        expect(untouched).toEqual(before); // configuring and readying moves no xu
        const result = await t.play(choice);
        const roll = result.match.roll!;

        const delta = (memberStake: number, memberChoice: number) =>
          gameId === 'slots' ? memberStake * (slotsMultiplier(roll) - 1) : bauDelta(roll, memberChoice, memberStake);

        const after = await t.ledger();
        const hostDelta = delta(stake, choice);
        expect(after.coins - before.coins).toBe(hostDelta);
        expect(result.match.session?.coinDelta).toBe(hostDelta);
        expect(result.match.session?.settled).toBe(true);
        expect(miniCoinDelta(result.match)).toBe(hostDelta);
        expect(result.match.outcome).toBe(hostDelta > 0 ? 'win' : 'loss');
        for (const bet of bets) {
          const botDelta = delta(bet.stake, bet.choice);
          expect(after.bots[bet.memberId] - before.bots[bet.memberId]).toBe(botDelta);
          expect(result.match.session?.housePayouts).toContainEqual({
            memberId: bet.memberId,
            delta: botDelta,
            coinsAfter: after.bots[bet.memberId],
          });
        }
        expect(result.match.session?.housePayouts).toContainEqual({
          memberId: HOST,
          delta: hostDelta,
          coinsAfter: after.coins,
        });
        for (const value of [after.coins, ...Object.values(after.bots)]) {
          expect(Number.isSafeInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
        if (hostDelta > 0) wins++;
        expect(after.wins).toBe(wins);
        staked += stake;
        returned += stake + hostDelta;
        const waiting = await t.next();
        expect(waiting.match.status).toBe('waiting');
        expect(waiting.match.session?.configured).toBe(false);
        expect(waiting.match.session?.settled).toBe(false);
        expect(waiting.match.session?.housePayouts).toBeUndefined();
        expect((await t.ledger()).coins).toBe(after.coins); // next-round is free
        before = after;
      }
      const rtp = returned / staked;
      console.log(
        `chance ${gameId} SDK rounds=3000 staked=${staked} RTP=${(rtp * 100).toFixed(4)}% win=${((wins / 3000) * 100).toFixed(4)}%`,
      );
      expect(Math.abs(rtp - (gameId === 'slots' ? 215 / 216 : 199 / 216))).toBeLessThan(0.08);
      expect((await t.sdk.getMiniLobby(gameId)).availableCoins).toBe(before.coins);
    });

  for (const gameId of CHANCE)
    it(`${gameId}: 400 practice rounds never move the host or bot wallets`, async () => {
      const t = table(gameId, 777);
      await t.open(3, 19);
      await expect(t.configure(1)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
      const start = await t.ledger();
      for (let round = 0; round < 400; round++) {
        const result = await t.configure(0, gameId === 'bau-cua' ? { choice: round % 6 } : {});
        expect(result.session?.members?.every((member) => member.stake === 0)).toBe(true);
        const played = await t.play(round % 6);
        expect(played.match.session?.coinDelta).toBe(0);
        expect(played.match.session?.housePayouts?.every((payout) => payout.delta === 0)).toBe(true);
        expect(miniMemberCoinDeltas(played.match).every((payout) => Object.is(payout.delta, 0))).toBe(true);
        await t.next();
      }
      const end = await t.ledger();
      expect({ coins: end.coins, bots: end.bots }).toEqual({ coins: start.coins, bots: start.bots });
    });

  for (const gameId of CHANCE)
    it(`${gameId}: retries, conflicting payloads, stale revisions and replays never pay twice`, async () => {
      const t = table(gameId, 1000);
      await t.open();
      await t.configure(100, gameId === 'bau-cua' ? { choice: 2 } : {});
      const action = gameId === 'bau-cua' ? ({ type: 'roll', symbol: 2 } as const) : ({ type: 'spin' } as const);
      const command = { gameId, matchId: t.match.id, revision: 1, requestId: 'result', action };
      const first = await t.sdk.playMini(command);
      const settled = await t.ledger();
      expect(settled.coins).toBe(1000 + first.match.session!.coinDelta!);
      for (let i = 0; i < 20; i++) expect(await t.sdk.playMini(command)).toEqual(first);
      expect(await t.ledger()).toEqual(settled);
      // Same request id, different payload.
      await expect(t.sdk.playMini({ ...command, revision: 2 })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
      await expect(
        t.sdk.playMini({ ...command, action: gameId === 'bau-cua' ? { type: 'roll', symbol: 3 } : { type: 'resign' } }),
      ).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
      // New request id replaying the settled revision, then acting on the finished round.
      await expect(t.sdk.playMini({ ...command, requestId: 'replay' })).rejects.toMatchObject({
        code: 'REQUEST_CONFLICT',
      });
      await expect(t.sdk.playMini({ ...command, requestId: 'again', revision: 2 })).rejects.toMatchObject({
        code: 'MATCH_FINISHED',
      });
      // The stake and the choice cannot be changed once the result exists.
      await expect(
        t.sdk.configureArcadeTable({
          gameId,
          matchId: t.match.id,
          revision: 2,
          requestId: 'late-config',
          stake: 1,
          difficulty: 'medium',
        }),
      ).rejects.toMatchObject({ code: 'MATCH_IN_PROGRESS' });
      await expect(
        t.sdk.updateArcadeMember({
          gameId,
          matchId: t.match.id,
          revision: 2,
          requestId: 'late-kick',
          action: { type: 'kick', memberId: BOTS[0] },
        }),
      ).rejects.toMatchObject({ code: 'MATCH_IN_PROGRESS' });
      // Leaving a finished round is free, and its retry is too.
      const leave = { gameId, matchId: t.match.id, revision: 2, requestId: 'leave' };
      expect((await t.sdk.leaveArcadeTable(leave)).coinDelta).toBe(0);
      expect((await t.sdk.leaveArcadeTable(leave)).coinDelta).toBe(0);
      await expect(t.sdk.playMini({ ...command, requestId: 'ghost' })).rejects.toMatchObject({ code: 'MAP_NOT_FOUND' });
      expect(await t.ledger()).toEqual(settled);
    });
});

describe('SDK exploit attempts', () => {
  for (const gameId of CHANCE)
    it(`${gameId}: invalid, oversized and unaffordable stakes are rejected and change nothing`, async () => {
      const t = table(gameId, 500);
      await t.open();
      const start = await t.ledger();

      const attempt = (stake: number, extra = {}) =>
        t.sdk.configureArcadeTable({
          gameId,
          matchId: t.match.id,
          revision: 0,
          requestId: t.id('bad'),
          stake,
          difficulty: 'medium',
          ...extra,
        });

      for (const stake of [-1, -100, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, 1e308])
        await expect(attempt(stake)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      await expect(attempt('100' as unknown as number)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      for (const stake of [0, 501, 1_000_000, Number.MAX_SAFE_INTEGER])
        await expect(attempt(stake)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
      for (const bets of [
        [{ memberId: 'stranger', stake: 1 }],
        [{ memberId: BOTS[0], stake: -5 }],
        [{ memberId: BOTS[0], stake: 1.5 }],
        [{ memberId: BOTS[0], stake: 1, choice: 6 }],
        [
          { memberId: BOTS[0], stake: 1 },
          { memberId: BOTS[0], stake: 2 },
        ],
      ])
        await expect(attempt(10, { bets })).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      for (const stake of [0, 10_001])
        await expect(attempt(10, { bets: [{ memberId: BOTS[0], stake }] })).rejects.toMatchObject({
          code: 'INSUFFICIENT_COINS',
        });
      if (gameId === 'slots')
        await expect(attempt(10, { choice: 1 })).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      else
        for (const choice of [-1, 6, 2.5])
          await expect(attempt(10, { choice })).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      expect(t.match.revision).toBe(0);
      expect((await t.sdk.getMiniLobby(gameId)).activeMatch?.session?.configured).toBe(false);
      expect(await t.ledger()).toEqual(start);
      // The whole wallet is a legal stake and can never go negative.
      await t.configure(500, gameId === 'bau-cua' ? { choice: 0 } : {});
      const result = await t.play(0);
      expect((await t.ledger()).coins).toBe(500 + result.match.session!.coinDelta!);
      expect((await t.ledger()).coins).toBeGreaterThanOrEqual(0);
    });

  it('bau-cua: malformed roll commands are rejected by the SDK', async () => {
    const t = table('bau-cua', 500);
    await t.open();
    await t.configure(10, { choice: 1 });

    const roll = (symbol: number) =>
      t.sdk.playMini({
        gameId: 'bau-cua',
        matchId: t.match.id,
        revision: 1,
        requestId: t.id('roll'),
        action: { type: 'roll', symbol },
      });

    for (const symbol of [-1, 6, 0.5, Number.NaN])
      await expect(roll(symbol)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    // The door stored with Ready cannot be swapped at roll time.
    await expect(roll(4)).rejects.toMatchObject({ code: 'INVALID_PLAY' });
    await expect(
      t.sdk.playMini({
        gameId: 'bau-cua',
        matchId: t.match.id,
        revision: 1,
        requestId: 'wrong-game-action',
        action: { type: 'spin' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAY' });
    expect((await t.ledger()).coins).toBe(500);
  });

  for (const gameId of CHANCE)
    it(`${gameId}: Roll/Spin needs a saved stake, every member ready, at least one opponent and the host`, async () => {
      const t = table(gameId, 500);
      await t.open();

      const member = (action: Parameters<typeof t.sdk.updateArcadeMember>[0]['action']) =>
        t.sdk
          .updateArcadeMember({ gameId, matchId: t.match.id, revision: t.revision, requestId: t.id('member'), action })
          .then((result) => {
            (t as { revision: number }).revision; // revision is tracked below
            return result;
          });

      const go = () =>
        t.sdk.playMini({
          gameId,
          matchId: t.match.id,
          revision: current,
          requestId: t.id('go'),
          action: gameId === 'bau-cua' ? { type: 'roll', symbol: 0 } : { type: 'spin' },
        });

      let current = 0;

      const memberAt = async (action: Parameters<typeof t.sdk.updateArcadeMember>[0]['action']) => {
        const result = await t.sdk.updateArcadeMember({
          gameId,
          matchId: t.match.id,
          revision: current,
          requestId: t.id('member'),
          action,
        });
        current++;
        return result;
      };

      void member;
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' }); // not configured
      await expect(memberAt({ type: 'ready', ready: true })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await t.sdk.configureArcadeTable({
        gameId,
        matchId: t.match.id,
        revision: current++,
        requestId: t.id('cfg'),
        stake: 50,
        difficulty: 'medium',
        ...(gameId === 'bau-cua' ? { choice: 0 } : {}),
      });
      await memberAt({ type: 'ready', ready: false, memberId: BOTS[1] });
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' }); // a bot is not ready
      await memberAt({ type: 'ready', ready: true, memberId: BOTS[1] });
      await memberAt({ type: 'ready', ready: false });
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' }); // host is not ready
      await memberAt({ type: 'ready', ready: true });
      for (const bot of BOTS) await memberAt({ type: 'kick', memberId: bot });
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' }); // alone at the table
      await expect(memberAt({ type: 'kick', memberId: HOST })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await memberAt({ type: 'invite-bot' });
      // Another account owning the table blocks every host command.
      await t.repository.transaction((d) => {
        d.mini![gameId]!.activeMatch!.session!.hostId = 'someone-else';
      });
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await expect(memberAt({ type: 'invite-bot' })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await expect(
        t.sdk.configureArcadeTable({
          gameId,
          matchId: t.match.id,
          revision: current,
          requestId: t.id('cfg'),
          stake: 50,
          difficulty: 'medium',
        }),
      ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await expect(
        t.sdk.leaveArcadeTable({ gameId, matchId: t.match.id, revision: current, requestId: t.id('leave') }),
      ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
      await t.repository.transaction((d) => {
        d.mini![gameId]!.activeMatch!.session!.hostId = HOST;
      });
      const result = await go();
      expect(result.match.status).toBe('finished');
      expect((await t.ledger()).coins).toBe(500 + result.match.session!.coinDelta!);
      // A new round cannot reuse the previous Ready/stake.
      current++;
      await t.sdk.playMini({
        gameId,
        matchId: t.match.id,
        revision: current++,
        requestId: t.id('next'),
        action: { type: 'next-round' },
      });
      await expect(go()).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    });

  for (const gameId of CHANCE)
    it(`${gameId}: one table at a time, and xu reserved by another game cannot be staked or spent`, async () => {
      const t = table(gameId, 1000);
      await t.open(0, 0);
      await expect(
        t.sdk.startMiniRoom({ gameId, roomId: 1, tableId: 5, requestId: 'second-table' }),
      ).rejects.toMatchObject({ code: 'MATCH_IN_PROGRESS' });
      // A wagered chess game in progress reserves 700 of the 1,000 xu.
      const chess = await t.sdk.startMiniRoom({ gameId: 'chess', roomId: 0, requestId: 'chess-open' });
      await t.sdk.configureArcadeTable({
        gameId: 'chess',
        matchId: chess.id,
        revision: 0,
        requestId: 'chess-config',
        stake: 700,
        difficulty: 'easy',
      });
      await t.sdk.playMini({
        gameId: 'chess',
        matchId: chess.id,
        revision: 1,
        requestId: 'chess-start',
        action: { type: 'start' },
      });
      expect((await t.sdk.getMiniLobby(gameId)).availableCoins).toBe(300);
      await expect(t.configure(301)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
      await expect(
        t.sdk.execute({
          type: 'buy-seeds',
          mapInstanceId: 'home',
          requestId: 'spend-reserved',
          cropId: 'strawberry',
          count: 31,
        }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
      await t.sdk.configureArcadeTable({
        gameId,
        matchId: t.match.id,
        revision: 0,
        requestId: 'fits',
        stake: 300,
        difficulty: 'medium',
        ...(gameId === 'bau-cua' ? { choice: 0 } : {}),
      });
      // Spending after the stake was saved is caught again at Roll/Spin time.
      await t.sdk.execute({
        type: 'buy-seeds',
        mapInstanceId: 'home',
        requestId: 'spend-free',
        cropId: 'strawberry',
        count: 1,
      });
      await expect(
        t.sdk.playMini({
          gameId,
          matchId: t.match.id,
          revision: 1,
          requestId: 'overdrawn',
          action: gameId === 'bau-cua' ? { type: 'roll', symbol: 0 } : { type: 'spin' },
        }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
      expect((await t.ledger()).coins).toBe(990);
    });
});

describe('defects found by simulation', () => {
  // DEFECT (stuck state): simulated bots are never topped up. Once a bot reaches 0 xu its default stake becomes
  // min(balance, stake) = 0, which the wager check rejects, so "Lưu & sẵn sàng" fails with INSUFFICIENT_COINS
  // although the host has plenty of xu. Bot wallets are shared by Bầu cua and Xèng and persist across tables.
  it('bau-cua: the host can keep playing after bots run out of simulated xu', async () => {
    const t = table('bau-cua', 100_000_000, () => 1_791_000_000_000);
    await t.open();
    for (let round = 0; round < 60; round++) {
      await t.configure(10_000, { choice: 0 }); // throws INSUFFICIENT_COINS in round 2 with this seed
      await t.play(0);
      await t.next();
    }
  });

  it('bau-cua: broke bots sit out without blocking a fresh table in either game', async () => {
    const t = table('bau-cua', 100_000_000);
    await t.open();
    await t.repository.transaction((document) => {
      for (const id of BOTS) document.arcadeBotCoins![id] = 0;
    });
    const configured = await t.configure(100, { choice: 0 });
    expect(configured.session!.members!.slice(1).every((member) => member.stake === 0)).toBe(true);
    await t.play(0);
    await t.next();
    expect(Object.values((await t.ledger()).bots)).toEqual([10000, 10000, 10000]);
    await t.sdk.leaveArcadeTable({
      gameId: 'bau-cua',
      matchId: t.match.id,
      revision: t.revision,
      requestId: 'leave-broke',
    });
    const slots = await t.sdk.startMiniRoom({ gameId: 'slots', roomId: 2, tableId: 7, requestId: 'slots-after' });
    const result = await t.sdk.configureArcadeTable({
      gameId: 'slots',
      matchId: slots.id,
      revision: 0,
      requestId: 'slots-config',
      stake: 1,
      difficulty: 'medium',
    });
    expect(result.session!.members!.every((member) => member.stake === 1)).toBe(true);
  });

  // DEFECT: the engine scores the round with the symbol sent in the roll action while the wallet is settled with
  // members[0].choice. `configure` without `choice` stores door 0 for the host but leaves match.choice unset, so
  // any symbol is accepted at roll time: the snapshot says "win ×k" on door 5 while the wallet pays door 0.
  it('bau-cua: the wallet is settled on the same door the result is scored on', async () => {
    for (let clock = 1; clock <= 40; clock++) {
      const t = table('bau-cua', 1000, () => clock * 7919);
      await t.open();
      await t.configure(100); // no choice in the payload, as the HTTP contract allows
      await expect(t.play(5)).rejects.toMatchObject({ code: 'INVALID_PLAY' });
      const result = await t.play(0);
      expect(result.match.choice).toBe(0);
      expect(result.match.session?.coinDelta).toBe(bauDelta(result.match.roll!, 0, 100));
    }
  });

  // DEFECT: same mismatch through the legacy `start` action, which moves the round to `playing` and thereby
  // skips the "symbol must equal the saved door" guard in playMini.
  it('bau-cua: the saved door cannot be swapped after a start action', async () => {
    const t = table('bau-cua', 1000);
    await t.open();
    await t.configure(100, { choice: 0 });
    await t.sdk.playMini({
      gameId: 'bau-cua',
      matchId: t.match.id,
      revision: 1,
      requestId: 'start',
      action: { type: 'start' },
    });
    await expect(
      t.sdk.playMini({
        gameId: 'bau-cua',
        matchId: t.match.id,
        revision: 2,
        requestId: 'swap',
        action: { type: 'roll', symbol: 3 },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAY' });
  });

  // DEFECT (exploit): the seed is Date.now() at table creation, it is never reseeded between rounds and the
  // generator is a bare 32-bit LCG. Anyone who knows roughly when the table was opened recovers the seed from
  // the first public result and then knows every later roll before choosing door and stake.
  it('bau-cua: knowing the opening time to ±30 s does not reveal future rolls', async () => {
    const opened = 1_791_000_000_000 + 17_321; // unknown to the attacker within ±30 s
    const t = table('bau-cua', 1000, () => opened);
    await t.open();
    // Enumerate the original ±30-second attack window using the current engine, including its seed mixer.
    const minimal = BOTS.map((memberId) => ({ memberId, stake: 1 }));
    const seen: number[][] = [];
    for (let round = 0; round < 2; round++) {
      await t.configure(1, { choice: 0, bets: minimal });
      seen.push((await t.play(0)).match.roll!);
      await t.next();
    }
    const candidates: number[] = [];
    const guessTime = 1_791_000_000_000;
    for (let time = guessTime - 30000; time <= guessTime + 30000; time++) {
      let candidate = createMiniMatch('bau-cua', 'attacker', 0, time);
      candidate.session = wager(1);
      let matches = true;
      for (const observation of seen) {
        const result = playMiniAction(candidate, { type: 'roll', symbol: 0 }).state;
        if (result.roll!.join() !== observation.join()) {
          matches = false;
          break;
        }
        candidate = playMiniAction(result, { type: 'next-round' }).state;
        candidate.session = wager(1);
      }
      if (matches) candidates.push(candidate.seed);
    }
    const storedSeed = await t.repository.transaction((document) => document.mini!['bau-cua']!.activeMatch!.seed);
    expect(candidates).not.toContain(storedSeed);
    let predicted = createMiniMatch('bau-cua', 'attacker', 0, opened);
    predicted.seed = candidates[0] ?? predicted.seed;
    predicted.session = wager(100);
    let correct = 0;
    let losses = 0;
    for (let round = 0; round < 20; round++) {
      const guess = playMiniAction(predicted, { type: 'roll', symbol: 0 }).state;
      const door = guess.roll![0];
      await t.configure(100, { choice: door, bets: minimal });
      const result = await t.play(door);
      if (result.match.roll!.join() === guess.roll!.join()) correct++;
      if (result.match.session!.coinDelta! <= 0) losses++;
      await t.next();
      predicted = playMiniAction(guess, { type: 'next-round' }).state;
      predicted.session = wager(100);
    }
    expect(correct).toBeLessThan(5);
    expect(losses).toBeGreaterThan(0);
  });

  // DEFECT: retry receipts are pruned with Object.keys(...).slice(0, -50). Integer-like keys are enumerated
  // first, so a numeric request id is treated as the oldest receipt and dropped immediately; its retry then
  // fails with REQUEST_CONFLICT instead of returning the stored result.
  it('slots: a retry with a numeric request id returns the stored result', async () => {
    const t = table('slots', 100_000);
    await t.open();
    for (let round = 0; round < 26; round++) {
      await t.configure(1); // 26 rounds × (play + next) fills the 50-receipt window with non-numeric ids
      await t.play();
      await t.next();
    }
    await t.configure(1);
    const command = {
      gameId: 'slots' as const,
      matchId: t.match.id,
      revision: t.revision,
      requestId: '12345',
      action: { type: 'spin' as const },
    };
    const first = await t.sdk.playMini(command);
    expect(await t.sdk.playMini(command)).toEqual(first);
  });
});

for (const gameId of CHANCE) {
  it(`${gameId}: cannot resign after start or reuse the previous round's roll`, async () => {
    const t = table(gameId, 1000);
    await t.open();
    await t.configure(100, gameId === 'bau-cua' ? { choice: 0 } : {});
    await t.play(0);
    await t.next();
    expect(t.match.roll).toBeUndefined();
    expect(t.match.choice).toBeUndefined();
    expect(t.match.multiplier).toBeUndefined();
    await t.configure(100, gameId === 'bau-cua' ? { choice: 0 } : {});
    const start = await t.sdk.playMini({
      gameId,
      matchId: t.match.id,
      revision: t.revision,
      requestId: 'legacy-start',
      action: { type: 'start' },
    });
    const before = await t.ledger();
    await expect(
      t.sdk.playMini({
        gameId,
        matchId: t.match.id,
        revision: start.match.revision,
        requestId: 'resign-exploit',
        action: { type: 'resign' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAY' });
    expect(await t.ledger()).toEqual(before);
    const played = await t.sdk.playMini({
      gameId,
      matchId: t.match.id,
      revision: start.match.revision,
      requestId: 'fresh-roll',
      action: gameId === 'bau-cua' ? { type: 'roll', symbol: 0 } : { type: 'spin' },
    });
    expect(played.match.session!.settled).toBe(true);
    expect((await t.ledger()).coins - before.coins).toBe(played.match.session!.coinDelta);
  });
}
it('shared bot wallets reserve a playing bet across both chance games', async () => {
  const t = table('bau-cua', 100000);
  await t.open();
  await t.configure(10000, { choice: 0 });
  await t.sdk.playMini({
    gameId: 'bau-cua',
    matchId: t.match.id,
    revision: 1,
    requestId: 'hold-bots',
    action: { type: 'start' },
  });
  const slots = await t.sdk.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'shared-slots' });
  const settings = await t.sdk.configureArcadeTable({
    gameId: 'slots',
    matchId: slots.id,
    revision: 0,
    requestId: 'shared-settings',
    stake: 10000,
    difficulty: 'medium',
  });
  expect(settings.session!.members!.slice(1).every((member) => member.stake === 0)).toBe(true);
  const result = await t.sdk.playMini({
    gameId: 'slots',
    matchId: slots.id,
    revision: 1,
    requestId: 'shared-spin',
    action: { type: 'spin' },
  });
  expect(
    result.match.session!.housePayouts!.slice(1).every((payout) => payout.delta === 0 && payout.coinsAfter === 10000),
  ).toBe(true);
  const bau = await t.sdk.playMini({
    gameId: 'bau-cua',
    matchId: t.match.id,
    revision: 2,
    requestId: 'held-roll',
    action: { type: 'roll', symbol: 0 },
  });
  expect(bau.match.session!.settled).toBe(true);
});

it('table receipts keep insertion age across numeric IDs and JSON normalization', async () => {
  const repository = createMemoryRepository();
  const sdk = createLocalSdk({ repository });
  const match = await sdk.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'receipt-order' });
  for (let index = 0; index < 55; index++) {
    const requestId = index % 2 ? `request-${index}` : String(1000 - index);
    await sdk.configureArcadeTable({
      gameId: 'slots',
      matchId: match.id,
      revision: index,
      requestId,
      stake: 1,
      difficulty: 'medium',
    });
  }
  const saved = await repository.transaction((document) => structuredClone(document));
  const reloaded = createMemoryRepository(JSON.parse(JSON.stringify(saved)));
  const records = await reloaded.transaction((document) => document.arcadeTableRequests!);
  expect(Object.keys(records)).toHaveLength(50);
  for (let index = 0; index < 55; index++) {
    const key = index % 2 ? `request-${index}` : String(1000 - index);
    expect(Object.hasOwn(records, key)).toBe(index >= 5);
  }
  const nextSdk = createLocalSdk({ repository: reloaded });
  const command = {
    gameId: 'slots' as const,
    matchId: match.id,
    revision: 55,
    requestId: '1',
    stake: 1,
    difficulty: 'medium' as const,
  };
  const result = await nextSdk.configureArcadeTable(command);
  const finalSave = await reloaded.transaction((document) => structuredClone(document));
  expect(Object.hasOwn(finalSave.arcadeTableRequests!, 'request-5')).toBe(false);
  const finalSdk = createLocalSdk({ repository: createMemoryRepository(JSON.parse(JSON.stringify(finalSave))) });
  expect(await finalSdk.configureArcadeTable(command)).toEqual(result);
});
it('chance seeds use crypto by default and an injected random source independently of the clock', async () => {
  const cryptoRandom = vi.spyOn(globalThis.crypto, 'getRandomValues');
  try {
    const repository = createMemoryRepository();
    const sdk = createLocalSdk({
      repository,

      clock: () => 42,
    });
    await sdk.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'crypto-seed' });
    expect(cryptoRandom).toHaveBeenCalledWith(expect.any(Uint32Array));
    const first = createLocalSdk({
      repository: createMemoryRepository(),

      clock: () => 1,

      random: () => 0.25,
    });
    const second = createLocalSdk({
      repository: createMemoryRepository(),

      clock: () => 999999,

      random: () => 0.25,
    });
    expect(await first.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'injected' })).toEqual(
      await second.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'injected' }),
    );
    for (const sdk of [first, second])
      await sdk.configureArcadeTable({
        gameId: 'slots',
        matchId: 'injected',
        revision: 0,
        requestId: 'config-injected',
        stake: 1,
        difficulty: 'medium',
      });
    const command = {
      gameId: 'slots' as const,
      matchId: 'injected',
      revision: 1,
      requestId: 'roll-injected',
      action: { type: 'spin' as const },
    };
    expect(await first.playMini(command)).toEqual(await second.playMini(command));
  } finally {
    cryptoRandom.mockRestore();
  }
});
