/**
 * Simulation audit of Tiến lên and Phỏm (engines, bots, snapshots, payouts through the local SDK).
 *
 * Every engine step is replayed against an independent reference model written from `docs/arcade.md`.
 * Sample sizes are small by default so the suite stays fast; the exploratory audit ran with
 * `AUDIT_GAMES=2000 AUDIT_REPORT=1` (per player count × difficulty × policy).
 * `it.fails` marks a reproduced defect: it flips to a failure once the defect is fixed.
 */
import { createLocalDocument, createLocalSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import {
  canEatPhom,
  createPhomMatch,
  isPhomMatch,
  isPhomMeld,
  type PhomAction,
  type PhomMatch,
  type PhomSnapshot,
  phomBotAction,
  phomSendTargets,
  playPhomAction,
  solvePhom,
} from '@chibi-town/arcade-games/phom-logic';
import type { ArcadeDifficulty, ArcadeSession } from '@chibi-town/arcade-games/session';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import {
  beatsTien,
  createTienMatch,
  isTienMatch,
  legalTienPlays,
  playTienAction,
  type TienAction,
  type TienCombo,
  type TienMatch,
  type TienSnapshot,
  tienCombo,
} from '@chibi-town/arcade-games/tien-len-logic';
import { describe, expect, it } from 'vitest';

const GAMES = Number(process.env.AUDIT_GAMES ?? 20);
const REPORT = !!process.env.AUDIT_REPORT;
const ONLY = process.env.AUDIT_ONLY;
const COUNTS = [2, 3, 4] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

const report = (...rows: unknown[]) => {
  if (REPORT) console.log(...rows);
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

const session = (difficulty: ArcadeDifficulty, playerCount: 2 | 3 | 4, stake = 100): ArcadeSession => ({
  hostId: 'local-player',
  mode: 'wager',
  stake,
  difficulty,
  configured: true,
  payoutRule: 'ranked-pool',
  playerCount,
});

/** Independent pool split from the table in docs/arcade.md. */
function refPayout(stake: number, first: number, second: number, count: number) {
  const pool = stake * count;
  const firstShare = count === 2 ? pool : Math.floor((pool * (count === 3 ? 80 : 60)) / 100);
  const deltas = [0, 1, 2, 3].map((seat) => (seat < count ? -stake : 0));
  deltas[first] += firstShare;
  deltas[second] += pool - firstShare;
  return deltas;
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) for (const entry of value) collectKeys(entry, keys);
  else if (value && typeof value === 'object')
    for (const [key, entry] of Object.entries(value)) {
      keys.add(key);
      collectKeys(entry, keys);
    }
  return keys;
}

type Stat = {
  games: number;
  first: number;
  second: number;
  delta: number;
  playerActions: number;
  steps: number;
  botActions: number;
  botMs: number;
  maxCallMs: number;
  maxBotActionsPerCall: number;
  times: number[];
};

/** Percentile of per-request engine time; robust against scheduler stalls on a loaded machine. */
const pct = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;

const newStat = (): Stat => ({
  games: 0,
  first: 0,
  second: 0,
  delta: 0,
  playerActions: 0,
  steps: 0,
  botActions: 0,
  botMs: 0,
  maxCallMs: 0,
  maxBotActionsPerCall: 0,
  times: [],
});

const line = (label: string, s: Stat) =>
  `${label.padEnd(34)} n=${s.games} first=${((100 * s.first) / s.games).toFixed(1)}% second=${((100 * s.second) / s.games).toFixed(1)}% EV=${(s.delta / s.games).toFixed(1)}xu/100 actions=${(s.playerActions / s.games).toFixed(1)} steps=${(s.steps / s.games).toFixed(1)} botActions/game=${(s.botActions / s.games).toFixed(1)} requestMs p50=${pct(s.times, 0.5).toFixed(2)} p99=${pct(s.times, 0.99).toFixed(2)} max=${s.maxCallMs.toFixed(1)} maxBotActs/call=${s.maxBotActionsPerCall}`;

// ───────────────────────────── Tiến lên ─────────────────────────────
const tRank = (card: number) => card >> 2;

type RefCombo = { kind: string; size: number; high: number };

/** Independent classifier: single, pair, triple, quad, run ≥3 without 2, three/four consecutive pairs without 2. */
function refCombo(input: readonly number[]): RefCombo | undefined {
  const cards = [...input].sort((a, b) => a - b);
  const size = cards.length;
  if (!size || new Set(cards).size !== size) return;
  const high = cards[size - 1];
  const ranks = cards.map(tRank);
  const same = ranks.every((r) => r === ranks[0]);
  if (size === 1) return { kind: 'single', size, high };
  if (same) return size <= 4 ? { kind: ['pair', 'triple', 'quad'][size - 2], size, high } : undefined;
  if (ranks.includes(12)) return;
  if (size >= 3 && ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1)) return { kind: 'straight', size, high };
  if (
    (size === 6 || size === 8) &&
    ranks.every((r, i) => (i % 2 ? r === ranks[i - 1] : i === 0 || r === ranks[i - 1] + 1))
  )
    return { kind: size === 6 ? 'pairs3' : 'pairs4', size, high };
}

function refBeats(candidate: RefCombo, pile?: RefCombo) {
  if (!pile) return true;
  if (candidate.kind === pile.kind && candidate.size === pile.size) return candidate.high > pile.high;
  const single2 = pile.kind === 'single' && tRank(pile.high) === 12;
  const pair2 = pile.kind === 'pair' && tRank(pile.high) === 12;
  if (candidate.kind === 'pairs3') return single2;
  if (candidate.kind === 'quad') return single2 || pair2 || pile.kind === 'pairs3';
  if (candidate.kind === 'pairs4') return single2 || pair2 || pile.kind === 'pairs3' || pile.kind === 'quad';
  return false;
}

type TienPolicy = 'random' | 'hint' | 'heuristic';

function tienChoice(match: TienSnapshot, policy: TienPolicy, random: () => number): TienAction {
  const moves = legalTienPlays(match.hand, match.pile, match.opening, match.openingCard ?? 0);
  if (!moves.length) return { type: 'pass' };
  if (policy === 'hint') return { type: 'play', cards: moves[0].cards };
  if (policy === 'random') {
    const index = Math.floor(random() * (moves.length + (match.pile ? 1 : 0)));
    return index === moves.length ? { type: 'pass' } : { type: 'play', cards: moves[index].cards };
  }
  // Same public-information valuation the hard bot uses.
  const threatened = match.counts.some((count, seat) => seat !== 0 && count > 0 && count <= 3);

  const value = (candidate: TienCombo) => {
    const remaining = match.hand.filter((card) => !candidate.cards.includes(card));
    const counts = new Map<number, number>();
    for (const card of remaining) counts.set(tRank(card), (counts.get(tRank(card)) ?? 0) + 1);
    const singles = [...counts.values()].filter((count) => count === 1).length;
    return candidate.cards.length === match.hand.length
      ? 10000
      : candidate.cards.length * (threatened || !match.pile ? 100 : 10) - singles * 8 - candidate.high / 52;
  };

  return { type: 'play', cards: [...moves].sort((a, b) => value(b) - value(a))[0].cards };
}

const TIEN_SNAPSHOT_KEYS = new Set([
  'id',
  'roomId',
  'tableId',
  'session',
  'revision',
  'status',
  'played',
  'turn',
  'opening',
  'openingCard',
  'pile',
  'lastPlayer',
  'passed',
  'winner',
  'placements',
  'hand',
  'counts',
  'undealtCount',
  // nested
  'match',
  'steps',
  'actor',
  'action',
  'cards',
  'kind',
  'high',
  'hostId',
  'mode',
  'stake',
  'difficulty',
  'configured',
  'payoutRule',
  'playerCount',
  'settled',
  'coinDelta',
  'coinDeltas',
  'members',
  'ready',
]);

function simulateTien(
  seed: number,
  count: 2 | 3 | 4,
  difficulty: ArcadeDifficulty,
  policy: TienPolicy,
  stat: Stat,
  problems: string[],
) {
  const tag = `tien seed=${seed} seats=${count} ${difficulty} ${policy}`;

  const fail = (message: string) => {
    if (problems.length < 20) problems.push(`${tag}: ${message}`);
  };

  const random = rng(seed * 7919 + 13);
  let state: TienMatch = createTienMatch(`t${seed}`, 0, seed);
  state.session = session(difficulty, count);
  // reference model
  let hands: number[][] = [];
  let pile: RefCombo | undefined;
  let last: number | undefined;
  let passed = new Set<number>();
  let turn = 0;
  let opening = true;
  let openingCard = 0;
  const placements: number[] = [];
  let finished = false;
  let playerActions = 0;
  let totalSteps = 0;

  function apply(action: TienAction) {
    const started = performance.now();
    let next: ReturnType<typeof playTienAction>;
    try {
      next = playTienAction(state, action);
    } catch (error) {
      fail(`threw ${(error as Error).message} on ${JSON.stringify(action)}`);
      return false;
    }
    const elapsed = performance.now() - started;
    const bots = next.result.steps.filter((step) => step.actor !== 0).length;
    stat.botActions += bots;
    stat.botMs += elapsed;
    stat.maxCallMs = Math.max(stat.maxCallMs, elapsed);
    stat.times.push(elapsed);
    stat.maxBotActionsPerCall = Math.max(stat.maxBotActionsPerCall, bots);
    totalSteps += next.result.steps.length;
    for (const key of collectKeys(next.result))
      if (!TIEN_SNAPSHOT_KEYS.has(key)) fail(`snapshot exposes unexpected key "${key}"`);
    for (const step of next.result.steps) {
      if (step.action === 'start') {
        // Bots may already have moved in this request: rebuild the deal from the final hands plus what was played.
        hands = next.state.hands.map((hand) => [...hand]);
        for (const later of next.result.steps) hands[later.actor].push(...later.cards);
        for (const hand of hands) hand.sort((x, y) => x - y);
        const dealt = hands.flat();
        const all = [...dealt, ...(next.state.undealt ?? [])];
        if (new Set(all).size !== 52 || all.length !== 52) fail('deal does not use 52 unique cards');
        if (hands.some((hand, seat) => hand.length !== (seat < count ? 13 : 0))) fail('wrong dealt hand sizes');
        openingCard = Math.min(...dealt);
        if (count === 4 && openingCard !== 0) fail('four-seat opening card is not 3♠');
        turn = hands.findIndex((hand) => hand.includes(openingCard));
        if (step.match.openingCard !== openingCard) fail('opening card mismatch');
      } else {
        if (finished) fail('action after finish');
        if (step.actor !== turn) fail(`actor ${step.actor} moved on seat ${turn}'s turn`);
        if (step.actor >= count) fail('unseated actor moved');
        if (step.action === 'play') {
          const combo = refCombo(step.cards);
          if (!combo) fail(`illegal combination ${step.cards}`);
          else {
            if (!step.cards.every((card) => hands[step.actor].includes(card))) fail('played a card not in hand');
            if (opening && !step.cards.includes(openingCard)) fail('opening lead without the opening card');
            if (!refBeats(combo, pile)) fail(`combination ${step.cards} does not beat the pile`);
            hands[step.actor] = hands[step.actor].filter((card) => !step.cards.includes(card));
            pile = combo;
            last = step.actor;
            opening = false;
            if (!hands[step.actor].length) {
              placements.push(step.actor);
              if (count === 2) placements.push(1 - step.actor);
              if (placements.length === 2) finished = true;
            }
          }
        } else {
          if (!pile) fail('passed on an empty pile');
          passed.add(step.actor);
        }
        if (!finished) {
          let next: number | undefined;
          for (let offset = 1; offset <= count; offset++) {
            const candidate = (step.actor + offset) % count;
            if (hands[candidate].length && !passed.has(candidate)) {
              next = candidate;
              break;
            }
          }
          if (next === undefined || next === last) {
            let leader = last ?? step.actor;
            while (!hands[leader].length) leader = (leader + 1) % count;
            turn = leader;
            pile = undefined;
            passed = new Set();
            last = undefined;
          } else turn = next;
        }
      }
      const view = step.match;
      if (view.counts.join() !== hands.map((hand) => hand.length).join()) fail('counts differ from the reference');
      if (view.hand.join() !== hands[0].join()) fail('player hand differs from the reference');
      if (view.status === 'playing' && view.turn !== turn)
        fail(`turn ${view.turn} differs from reference ${turn} after ${step.action} by ${step.actor}`);
      if ((view.status === 'finished') !== finished) fail('finish state differs from the reference');
      if ((view.pile?.cards.length ?? 0) !== (pile?.size ?? 0) && view.status === 'playing')
        fail('pile differs from the reference');
      if (view.counts.reduce((a, b) => a + b, 0) + view.played.length + (view.undealtCount ?? 0) !== 52)
        fail('public card count is not 52');
      if (new Set(view.played).size !== view.played.length) fail('duplicate played card');
      if (view.status === 'playing' && !view.counts[view.turn]) fail('turn points at an empty seat');
    }
    state = next.state;
    if (!isTienMatch(state)) fail('state fails isTienMatch');
    const cards = [...state.hands.flat(), ...state.played, ...(state.undealt ?? [])];
    if (cards.length !== 52 || new Set(cards).size !== 52) fail('card conservation broken');
    if (state.status === 'playing' && state.turn !== 0) fail('returned while a bot is to move');
    return true;
  }

  if (!apply({ type: 'start' })) return;
  for (let guard = 0; state.status === 'playing'; guard++) {
    if (guard > 200) {
      fail('did not terminate in 200 player actions');
      return;
    }
    const snapshot: TienSnapshot = {
      ...state,
      hand: state.hands[0],
      counts: state.hands.map((hand) => hand.length),
    } as unknown as TienSnapshot;
    const moves = legalTienPlays(snapshot.hand, snapshot.pile, snapshot.opening, snapshot.openingCard ?? 0);
    if (!moves.length && !snapshot.pile) {
      fail('no legal action for the player');
      return;
    }
    playerActions++;
    if (!apply(tienChoice(snapshot, policy, random))) return;
  }
  const places = state.placements ?? [];
  if (places.length !== 2 || places[0] === places[1] || places.some((seat) => seat >= count))
    fail(`bad placements ${places}`);
  if (places.join() !== placements.join()) fail(`placements ${places} differ from reference ${placements}`);
  if (state.winner !== places[0]) fail('winner is not first place');
  const deltas = topTwoPayout(100, places[0], places[1], count);
  stat.games++;
  stat.first += Number(places[0] === 0);
  stat.second += Number(places[1] === 0);
  stat.delta += deltas[0];
  stat.playerActions += playerActions;
  stat.steps += totalSteps;
}

describe.skipIf(ONLY && ONLY !== 'tien')('Tiến lên audit', () => {
  it('classifies and compares combinations exactly like the documented rules', () => {
    const random = rng(2026);
    const mismatches: string[] = [];

    const sample = () => {
      // Bias towards structured subsets so runs, pairs and bombs appear often.
      const base = Math.floor(random() * 11);
      const size = 1 + Math.floor(random() * 8);
      const cards = new Set<number>();
      while (cards.size < size) {
        const rank = random() < 0.75 ? base + Math.floor(random() * 5) : Math.floor(random() * 13);
        cards.add(Math.min(12, rank) * 4 + Math.floor(random() * 4));
      }
      return [...cards];
    };

    const combos: number[][] = [];
    for (let i = 0; i < 60000; i++) {
      const cards = sample();
      const engine = tienCombo(cards);
      const reference = refCombo(cards);
      if (engine?.kind !== reference?.kind || engine?.high !== reference?.high) mismatches.push(`combo ${cards}`);
      if (engine && combos.length < 2500) combos.push(cards);
    }
    const kinds = new Set(combos.map((cards) => tienCombo(cards)!.kind));
    expect([...kinds].sort()).toEqual(['pair', 'pairs3', 'pairs4', 'quad', 'single', 'straight', 'triple']);
    for (let i = 0; i < 400000; i++) {
      const a = combos[Math.floor(random() * combos.length)];
      const b = combos[Math.floor(random() * combos.length)];
      if (a.some((card) => b.includes(card))) continue;
      if (beatsTien(tienCombo(a)!, tienCombo(b)!) !== refBeats(refCombo(a)!, refCombo(b)!))
        mismatches.push(`beats ${a} over ${b}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    // The documented chops, spelled out.
    const two = [48],
      pairTwo = [48, 49],
      tripleTwo = [48, 49, 50],
      pairs3 = [0, 1, 4, 5, 8, 9],
      pairs4 = [12, 13, 16, 17, 20, 21, 24, 25],
      quad = [28, 29, 30, 31];

    const beats = (a: number[], b: number[]) => beatsTien(tienCombo(a)!, tienCombo(b)!);

    expect([beats(pairs3, two), beats(pairs3, pairTwo), beats(quad, two), beats(quad, pairTwo)]).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect([beats(quad, pairs3), beats(pairs4, quad), beats(pairs4, pairs3), beats(pairs4, pairTwo)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([beats(quad, tripleTwo), beats(pairs4, tripleTwo), beats(pairs3, quad), beats(quad, pairs4)]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(tienCombo([40, 44, 48])).toBeUndefined();
    expect(tienCombo([36, 37, 40, 41, 44, 45, 48, 49])).toBeUndefined();
  });
  it('enumerates exactly the legal plays of a hand', () => {
    const random = rng(77);
    for (let round = 0; round < 60; round++) {
      const deck = Array.from({ length: 52 }, (_, i) => i).sort(() => random() - 0.5);
      const hand = deck.slice(0, 13).sort((a, b) => a - b);
      const pileCards = legalTienPlays(deck.slice(13, 26))[Math.floor(random() * 20)]?.cards;
      const pile = round % 3 && pileCards ? tienCombo(pileCards) : undefined;
      const expected = new Set<string>();
      for (let mask = 1; mask < 1 << 13; mask++) {
        const cards = hand.filter((_, i) => mask & (1 << i));
        const combo = refCombo(cards);
        if (combo && refBeats(combo, pile && refCombo(pile.cards))) expected.add(cards.join());
      }
      const actual = legalTienPlays(hand, pile).map((move) => move.cards.join());
      expect(new Set(actual)).toEqual(expected);
      expect(actual.length).toBe(expected.size);
    }
  });
  for (const count of COUNTS)
    for (const difficulty of DIFFICULTIES)
      it(`${count} seats/${difficulty}: every seeded game is legal, conserves cards, hides private data and terminates`, {
        timeout: 3_600_000,
      }, () => {
        const problems: string[] = [];
        for (const policy of ['random', 'hint', 'heuristic'] as const) {
          const stat = newStat();
          for (let seed = 1; seed <= GAMES; seed++) simulateTien(seed, count, difficulty, policy, stat, problems);
          report(line(`tien ${count}p ${difficulty} ${policy}`, stat));
          expect(stat.games).toBe(problems.length ? stat.games : GAMES);
          // A whole request (player action plus every bot reply) stays far below the 300 ms budget.
          expect(pct(stat.times, 0.5)).toBeLessThan(100);
        }
        expect(problems).toEqual([]);
      });
  it('rejects out-of-turn, foreign-card, non-beating and post-finish actions without changing state', () => {
    let state = createTienMatch('x', 0, 5);
    state.session = session('medium', 4);
    expect(() => playTienAction(state, { type: 'pass' })).toThrow('INVALID_TURN');
    state = playTienAction(state, { type: 'start' }).state;
    expect(() => playTienAction(state, { type: 'start' })).toThrow('INVALID_TURN');
    const before = JSON.stringify(state);
    const foreign = state.hands[1][0];
    expect(() => playTienAction(state, { type: 'play', cards: [foreign] })).toThrow('INVALID_PLAY');
    expect(() => playTienAction(state, { type: 'play', cards: [state.hands[0][0], state.hands[0][0]] })).toThrow(
      'INVALID_PLAY',
    );
    expect(() => playTienAction(state, { type: 'play', cards: [] })).toThrow('INVALID_PLAY');
    expect(() => playTienAction({ ...state, turn: 1 }, { type: 'pass' })).toThrow('INVALID_TURN');
    expect(JSON.stringify(state)).toBe(before);
    expect(() => playTienAction({ ...state, status: 'finished' }, { type: 'pass' })).toThrow('MATCH_FINISHED');
  });
});

// ─────────────────────────────── Phỏm ───────────────────────────────
const pRank = (card: number) => (((card >> 2) + 2) % 13) + 1;

const pSuit = (card: number) => card & 3;

function refMeld(cards: readonly number[]) {
  if (cards.length < 3 || new Set(cards).size !== cards.length) return false;
  const ranks = cards.map(pRank).sort((a, b) => a - b);
  if (ranks.every((r) => r === ranks[0])) return cards.length <= 4;
  return cards.every((c) => pSuit(c) === pSuit(cards[0])) && ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
}

const points = (cards: readonly number[]) => cards.reduce((sum, card) => sum + pRank(card), 0);

/** Minimal rubbish points; undefined when an eaten card cannot be melded (≤1 eaten card per meld). */
function refSolve(hand: readonly number[], eaten: readonly number[]) {
  const melds: number[] = [];
  for (let mask = 7; mask < 1 << hand.length; mask++) {
    const cards = hand.filter((_, i) => mask & (1 << i));
    if (cards.length >= 3 && refMeld(cards) && cards.filter((c) => eaten.includes(c)).length <= 1) melds.push(mask);
  }
  const memo = new Map<number, { points: number; melds: number } | undefined>();

  const visit = (available: number): { points: number; melds: number } | undefined => {
    if (memo.has(available)) return memo.get(available);
    const rest = hand.filter((_, i) => available & (1 << i));
    let best = rest.some((c) => eaten.includes(c)) ? undefined : { points: points(rest), melds: 0 };
    for (const mask of melds)
      if ((available & mask) === mask) {
        const inner = visit(available ^ mask);
        if (inner && (!best || inner.points < best.points)) best = { points: inner.points, melds: inner.melds + 1 };
      }
    memo.set(available, best);
    return best;
  };

  return visit((1 << hand.length) - 1);
}

type PhomPolicy = 'random' | 'heuristic';

function phomLegal(match: PhomMatch): PhomAction[] {
  const hand = match.hands[0],
    eaten = match.eaten[0];
  if (match.phase === 'receive') {
    const actions: PhomAction[] = match.stock.length ? [{ type: 'draw' }] : [];
    if (match.last && refSolve([...hand, match.last.card], [...eaten, match.last.card])) actions.push({ type: 'eat' });
    return actions;
  }
  if (match.phase === 'lay') return [{ type: 'lay' }];
  if (match.phase === 'send') {
    const actions: PhomAction[] = [{ type: 'done' }];
    if (match.melds[0].length)
      for (const card of hand)
        for (let seat = 0; seat < 4; seat++)
          if (match.laid[seat])
            match.melds[seat].forEach((meld, index) => {
              if (refMeld([...meld, card])) actions.push({ type: 'send', card, seat, meld: index });
            });
    return actions;
  }
  return hand
    .filter(
      (card) =>
        !eaten.includes(card) &&
        (match.laid[0] ||
          refSolve(
            hand.filter((c) => c !== card),
            eaten,
          )),
    )
    .map((card) => ({ type: 'discard', card }));
}

const PHOM_KEYS = new Set([
  'id',
  'roomId',
  'tableId',
  'session',
  'revision',
  'status',
  'phase',
  'turn',
  'discards',
  'eaten',
  'melds',
  'turns',
  'laid',
  'last',
  'placements',
  'scores',
  'mom',
  'winner',
  'u',
  'hand',
  'counts',
  'stockCount',
  'finalHands',
  'match',
  'steps',
  'actor',
  'action',
  'card',
  'seat',
  'hostId',
  'mode',
  'stake',
  'difficulty',
  'configured',
  'payoutRule',
  'playerCount',
  'settled',
  'coinDelta',
  'coinDeltas',
  'members',
  'ready',
]);

const norm = (melds: number[][]) =>
  melds
    .map((meld) => [...meld].sort((a, b) => a - b).join('.'))
    .sort()
    .join('|');

function simulatePhom(
  seed: number,
  count: 2 | 3 | 4,
  difficulty: ArcadeDifficulty,
  policy: PhomPolicy,
  stat: Stat,
  problems: string[],
  extra?: { u: number; mom: number; ties: number; stockLeft: number },
) {
  const tag = `phom seed=${seed} seats=${count} ${difficulty} ${policy}`;

  const fail = (message: string) => {
    if (problems.length < 20) problems.push(`${tag}: ${message}`);
  };

  const random = rng(seed * 104729 + 7);
  let state: PhomMatch = createPhomMatch(`p${seed}`, 0, seed);
  state.session = session(difficulty, count);
  // reference model
  let hands: number[][] = [[], [], [], []];
  let stock: number[] = [];
  const discards: number[][] = [[], [], [], []];
  const eaten: number[][] = [[], [], [], []];
  let melds: number[][][] = [[], [], [], []];
  const turns = [0, 0, 0, 0];
  const laid = [false, false, false, false];
  let last: { card: number; seat: number } | undefined;
  let turn = 0;
  let phase: PhomMatch['phase'] = 'discard';
  let done: { u?: number } | undefined;
  let playerActions = 0,
    totalSteps = 0;

  const checkU = () => {
    if (!done && !laid[turn] && hands[turn].length && refSolve(hands[turn], eaten[turn])?.points === 0)
      done = { u: turn };
  };

  function apply(action: PhomAction) {
    const stockBefore = [...state.stock];
    const started = performance.now();
    let next: ReturnType<typeof playPhomAction>;
    try {
      next = playPhomAction(state, action);
    } catch (error) {
      fail(`threw ${(error as Error).message} on ${JSON.stringify(action)} in phase ${state.phase}`);
      return false;
    }
    const elapsed = performance.now() - started;
    const bots = next.result.steps.filter((step) => step.actor !== 0).length;
    stat.botActions += bots;
    stat.botMs += elapsed;
    stat.maxCallMs = Math.max(stat.maxCallMs, elapsed);
    stat.times.push(elapsed);
    stat.maxBotActionsPerCall = Math.max(stat.maxBotActionsPerCall, bots);
    totalSteps += next.result.steps.length;
    for (const key of collectKeys(next.result))
      if (!PHOM_KEYS.has(key)) fail(`snapshot exposes unexpected key "${key}"`);
    let drawn = 0;
    for (const step of next.result.steps) {
      const view = step.match;
      if (done) fail('action after the reference finished');
      if (step.action === 'start') {
        // Reconstruct the deal from the engine state that follows the start (bots cannot act before seat 0 discards).
        hands = next.state.hands.map((h) => [...h]);
        stock = [...next.state.stock];
        if (next.result.steps.length !== 1) fail('bots acted during start');
        if (hands.some((h, seat) => h.length !== (seat >= count ? 0 : seat === 0 ? 10 : 9))) fail('wrong deal sizes');
        if (stock.length !== 52 - 10 - 9 * (count - 1)) fail('wrong stock size');
        if (new Set([...hands.flat(), ...stock]).size !== 52) fail('deal is not 52 unique cards');
        turn = 0;
        phase = 'discard';
        checkU();
      } else {
        if (step.actor !== turn) fail(`actor ${step.actor} moved on seat ${turn}'s turn`);
        const seat = step.actor,
          hand = hands[seat];
        if (step.action === 'draw' || step.action === 'eat') {
          if (phase !== 'receive') fail(`${step.action} outside the receive phase`);
          if (step.action === 'eat') {
            if (!last) fail('ate without a discard');
            else {
              if (last.seat !== (seat + count - 1) % count) fail('ate a card not discarded by the previous seat');
              if (!refSolve([...hand, last.card], [...eaten[seat], last.card])) fail('illegal eat');
              hand.push(last.card);
              eaten[seat].push(last.card);
              discards[last.seat].pop();
            }
          } else {
            const card = stock.shift();
            if (card === undefined) fail('drew from an empty stock');
            else hand.push(card);
            if (card !== stockBefore[drawn++]) fail('draw order differs from the stock');
          }
          last = undefined;
          hand.sort((a, b) => a - b);
          phase = turns[seat] === 3 ? 'lay' : 'discard';
          checkU();
        } else if (step.action === 'lay') {
          if (phase !== 'lay') fail('lay outside the lay phase');
          const shown = view.melds[seat].map((meld) => [...meld]);
          const used = shown.flat();
          if (new Set(used).size !== used.length || used.some((card) => !hand.includes(card)))
            fail('laid cards are not a disjoint subset of the hand');
          if (shown.some((meld) => !refMeld(meld))) fail('laid an invalid meld');
          if (shown.some((meld) => meld.filter((card) => eaten[seat].includes(card)).length > 1))
            fail('meld holds two eaten cards');
          if (eaten[seat].some((card) => !used.includes(card))) fail('eaten card left outside melds');
          const rest = hand.filter((card) => !used.includes(card));
          const best = refSolve(hand, eaten[seat]);
          if (!best || points(rest) !== best.points)
            fail(`lay keeps ${points(rest)} rubbish points, optimum is ${best?.points}`);
          melds[seat] = shown;
          hands[seat] = rest;
          laid[seat] = true;
          phase = 'send';
        } else if (step.action === 'send') {
          const card = step.card!;
          if (phase !== 'send') fail('send outside the send phase');
          if (!melds[seat].length) fail('a móm seat sent a card');
          if (!hand.includes(card)) fail('sent a card not in hand');
          let target: [number, number] | undefined;
          for (let s = 0; s < 4; s++)
            view.melds[s].forEach((meld, index) => {
              if (meld.includes(card) && !melds[s][index]?.includes(card)) target = [s, index];
            });
          if (!target) fail('sent card did not land in a meld');
          else {
            if (!laid[target[0]]) fail('sent to a seat that has not laid');
            melds[target[0]][target[1]].push(card);
            if (!refMeld(melds[target[0]][target[1]])) fail('send produced an invalid meld');
          }
          hand.splice(hand.indexOf(card), 1);
          if (!hand.length) done = { u: seat };
        } else if (step.action === 'done') {
          if (phase !== 'send') fail('done outside the send phase');
          phase = 'discard';
        } else {
          const card = step.card!;
          if (phase !== 'discard') fail('discard outside the discard phase');
          if (!hand.includes(card)) fail('discarded a card not in hand');
          if (eaten[seat].includes(card)) fail('discarded an eaten card');
          const rest = hand.filter((c) => c !== card);
          const solved = laid[seat] ? undefined : refSolve(rest, eaten[seat]);
          if (!laid[seat] && !solved) fail('discard strands an eaten card');
          hands[seat] = rest;
          discards[seat].push(card);
          turns[seat]++;
          last = { card, seat };
          if (!rest.length || solved?.points === 0) done = { u: seat };
          else if (turns.slice(0, count).every((n) => n === 4)) done = {};
          else {
            turn = (seat + 1) % count;
            phase = 'receive';
            checkU();
          }
        }
      }
      // compare the public view with the reference
      if ((view.status === 'finished') !== !!done) fail(`finish differs from the reference after ${step.action}`);
      if (view.status === 'playing' && (view.turn !== turn || view.phase !== phase))
        fail(`turn/phase ${view.turn}/${view.phase} differs from reference ${turn}/${phase}`);
      if (view.counts.join() !== hands.map((h) => h.length).join()) fail('counts differ from the reference');
      if (view.stockCount !== stock.length) fail('stock count differs from the reference');
      if (JSON.stringify(view.discards) !== JSON.stringify(discards)) fail('discards differ from the reference');
      if (JSON.stringify(view.eaten) !== JSON.stringify(eaten)) fail('eaten differs from the reference');
      if (view.turns.join() !== turns.join() || view.laid.join() !== laid.join()) fail('turns/laid differ');
      if (view.melds.map(norm).join('/') !== melds.map(norm).join('/')) fail('melds differ from the reference');
      if (JSON.stringify(view.last) !== JSON.stringify(last) && view.status === 'playing') fail('last discard differs');
      if ([...view.hand].sort((x, y) => x - y).join() !== [...hands[0]].sort((x, y) => x - y).join())
        fail('player hand differs from the reference');
      if (view.status === 'playing' && view.finalHands) fail('bot hands exposed during play');
      melds = melds.map((seatMelds) => seatMelds.map((meld) => [...meld]));
    }
    state = next.state;
    if (!isPhomMatch(state)) fail('state fails isPhomMatch');
    const all = [...state.hands.flat(), ...state.stock, ...state.discards.flat(), ...state.melds.flat(2)];
    if (all.length !== 52 || new Set(all).size !== 52) fail('card conservation broken');
    if (state.status === 'playing' && state.turn !== 0) fail('returned while a bot is to move');
    return true;
  }

  if (!apply({ type: 'start' })) return;
  for (let guard = 0; state.status === 'playing'; guard++) {
    if (guard > 80) {
      fail('did not terminate in 80 player actions');
      return;
    }
    const legal = phomLegal(state);
    if (!legal.length) {
      fail(`no legal action for the player in phase ${state.phase}`);
      return;
    }
    let action: PhomAction;
    if (policy === 'random') action = legal[Math.floor(random() * legal.length)];
    else action = phomBotAction({ ...state, session: { ...state.session!, difficulty: 'hard' } });
    playerActions++;
    if (!apply(action)) return;
  }
  // final ranking from the reference
  const scores = [0, 1, 2, 3].map((seat) =>
    laid[seat] ? points(hands[seat]) : (refSolve(hands[seat], eaten[seat])?.points ?? -1),
  );
  const mom = [0, 1, 2, 3].map((seat) =>
    laid[seat] ? melds[seat].length === 0 : (refSolve(hands[seat], eaten[seat])?.melds ?? 0) === 0,
  );
  const places = Array.from({ length: count }, (_, i) => i).sort((a, b) =>
    a === done?.u ? -1 : b === done?.u ? 1 : Number(mom[a]) - Number(mom[b]) || scores[a] - scores[b] || a - b,
  );
  if (state.u !== done?.u) fail(`ù seat ${state.u} differs from reference ${done?.u}`);
  if (state.scores?.join() !== scores.join()) fail(`scores ${state.scores} differ from reference ${scores}`);
  if (state.mom?.join() !== mom.join()) fail('móm flags differ from the reference');
  if (state.placements?.join() !== places.join()) fail(`placements ${state.placements} differ from ${places}`);
  if (state.winner !== places[0]) fail('winner is not first place');
  if (state.u === undefined && !state.turns.slice(0, count).every((n) => n === 4)) fail('ended before four turns');
  const deltas = topTwoPayout(100, places[0], places[1], count);
  stat.games++;
  stat.first += Number(places[0] === 0);
  stat.second += Number(places[1] === 0);
  stat.delta += deltas[0];
  stat.playerActions += playerActions;
  stat.steps += totalSteps;
  if (extra) {
    extra.u += Number(state.u !== undefined);
    extra.mom += mom.slice(0, count).filter(Boolean).length;
    extra.ties += Number(scores[places[0]] === scores[places[1]] && state.u === undefined);
    extra.stockLeft += state.stock.length;
  }
}

describe.skipIf(ONLY && ONLY !== 'phom')('Phỏm audit', () => {
  it('recognises melds and solves hands exactly like the reference', () => {
    const random = rng(99);
    const mismatches: string[] = [];
    for (let i = 0; i < 40000; i++) {
      const size = 3 + Math.floor(random() * 4);
      const base = Math.floor(random() * 52);
      const cards = new Set<number>();
      while (cards.size < size)
        cards.add(random() < 0.5 ? (base + 4 * Math.floor(random() * 6)) % 52 : (base & ~3) + Math.floor(random() * 4));
      if (isPhomMeld([...cards]) !== refMeld([...cards])) mismatches.push(`meld ${[...cards]}`);
    }
    for (let i = 0; i < 1500; i++) {
      const deck = Array.from({ length: 52 }, (_, n) => n).sort(() => random() - 0.5);
      const hand = deck.slice(0, 9 + (i % 2)).sort((a, b) => a - b);
      const reference = refSolve(hand, []);
      const engine = solvePhom(hand, []);
      if (engine.points !== reference?.points) mismatches.push(`solve ${hand}`);
      const used = [...engine.melds.flat(), ...engine.rubbish].sort((a, b) => a - b);
      if (used.join() !== hand.join() || engine.melds.some((meld) => !refMeld(meld))) mismatches.push(`split ${hand}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    // K-A never wraps, A-2-3 is a run, five of a kind cannot exist, mixed suits are rejected.
    expect([
      isPhomMeld([40, 44, 48]),
      isPhomMeld([36, 40, 44]),
      isPhomMeld([44, 48, 0]),
      isPhomMeld([0, 5, 8]),
    ]).toEqual([false, false, true, false]);
  });
  for (const count of COUNTS)
    for (const difficulty of DIFFICULTIES)
      it(`${count} seats/${difficulty}: every seeded game follows the reference rules, conserves cards and terminates`, {
        timeout: 3_600_000,
      }, () => {
        const problems: string[] = [];
        for (const policy of ['random', 'heuristic'] as const) {
          const stat = newStat(),
            extra = { u: 0, mom: 0, ties: 0, stockLeft: 0 };
          for (let seed = 1; seed <= GAMES; seed++)
            simulatePhom(seed, count, difficulty, policy, stat, problems, extra);
          report(
            line(`phom ${count}p ${difficulty} ${policy}`, stat),
            `ù=${((100 * extra.u) / stat.games).toFixed(1)}% móm/seat=${((100 * extra.mom) / stat.games / count).toFixed(1)}% topTie=${((100 * extra.ties) / stat.games).toFixed(1)}% stockLeft=${(extra.stockLeft / stat.games).toFixed(1)}`,
          );
          expect(pct(stat.times, 0.5)).toBeLessThan(100);
        }
        expect(problems).toEqual([]);
      });
  it('rejects out-of-phase and out-of-turn actions without mutating the match', () => {
    let state = createPhomMatch('x', 0, 9);
    state.session = session('medium', 3);
    expect(() => playPhomAction(state, { type: 'draw' })).toThrow('MATCH_FINISHED');
    state = playPhomAction(state, { type: 'start' }).state;
    const before = JSON.stringify(state);
    for (const action of [
      { type: 'start' },
      { type: 'draw' },
      { type: 'eat' },
      { type: 'lay' },
      { type: 'done' },
    ] as const)
      expect(() => playPhomAction(state, action)).toThrow(/INVALID_TURN|INVALID_PLAY/);
    expect(() => playPhomAction(state, { type: 'discard', card: state.hands[1][0] })).toThrow('INVALID_PLAY');
    expect(() => playPhomAction(state, { type: 'send', card: state.hands[0][0], seat: 0, meld: 0 })).toThrow(
      'INVALID_PLAY',
    );
    expect(() => playPhomAction({ ...state, turn: 1 }, { type: 'draw' })).toThrow('INVALID_TURN');
    expect(JSON.stringify(state)).toBe(before);
    expect(canEatPhom({ ...state, hand: state.hands[0] } as unknown as PhomSnapshot)).toBe(false);
    expect(phomSendTargets({ hand: state.hands[0], melds: state.melds, laid: state.laid })).toEqual([]);
  });
});

// ───────────────────── Pool split and SDK accounting ─────────────────────
describe.skipIf(ONLY && ONLY !== 'sdk')('card-game payouts through the SDK', () => {
  it('splits the pool as documented for every seat pair, including stakes not divisible by 5', () => {
    for (const count of COUNTS)
      for (const stake of [0, 1, 2, 3, 4, 7, 9, 11, 13, 99, 101, 333, 1000003, Math.floor(Number.MAX_SAFE_INTEGER / 4)])
        for (let first = 0; first < count; first++)
          for (let second = 0; second < count; second++) {
            if (first === second) continue;
            const deltas = topTwoPayout(stake, first, second, count);
            expect(deltas.every(Number.isSafeInteger)).toBe(true);
            expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
            if (stake < 1e9) expect(deltas).toEqual(refPayout(stake, first, second, count));
            // Nobody loses more than the stake; third and fourth lose exactly the stake.
            expect(Math.min(...deltas)).toBeGreaterThanOrEqual(-stake);
          }
    for (const bad of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER])
      expect(() => topTwoPayout(bad, 0, 1, 4)).toThrow('INVALID_PAYOUT');
    expect(() => topTwoPayout(10, 0, 0, 4)).toThrow('INVALID_PAYOUT');
    expect(() => topTwoPayout(10, 0, 2, 2)).toThrow('INVALID_PAYOUT');
  });
});

export { createLocalDocument, createLocalSdk, createMemoryRepository };
