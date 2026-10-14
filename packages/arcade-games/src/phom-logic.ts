import { validSavedArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { type ArcadeSession, validArcadeSession } from './session.js';
import type { TableSnapshot } from './table-snapshot.js';

/** Card IDs match the shared card renderer; Phom ranks are A=1 .. K=13, never wrap K-A. */
export const phomRank = (card: number) => ((Math.floor(card / 4) + 2) % 13) + 1;

export type PhomAction =
  | { [K in 'start' | 'draw' | 'eat' | 'lay' | 'done']: { type: K } }['start' | 'draw' | 'eat' | 'lay' | 'done']
  | { type: 'discard'; card: number }
  | { type: 'send'; card: number; seat: number; meld: number };
export type PhomMatch = {
  id: string;
  roomId: number;
  tableId: number;
  session?: ArcadeSession;
  seed: number;
  revision: number;
  status: 'waiting' | 'playing' | 'finished';
  phase: 'receive' | 'discard' | 'lay' | 'send';
  turn: number;
  hands: number[][];
  stock: number[];
  discards: number[][];
  eaten: number[][];
  melds: number[][][];
  turns: number[];
  laid: boolean[];
  last?: { card: number; seat: number };
  placements?: number[];
  scores?: number[];
  mom?: boolean[];
  winner?: number;
  u?: number;
};
export type PhomSnapshot = Omit<PhomMatch, 'hands' | 'stock' | 'seed'> & {
  hand: number[];
  counts: number[];
  stockCount: number;
  finalHands?: number[][];
  lastSteps?: { revision: number; steps: PhomResult['steps'][number][] };
  serverTime?: number;
  turnEndsAt?: number;
  players?: TableSnapshot<never>['players'];
};
export type PhomResult = {
  match: PhomSnapshot;
  steps: { actor: number; action: PhomAction['type']; card?: number; match: PhomSnapshot }[];
};

const cardsValid = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length <= 52 &&
  v.every((c) => Number.isInteger(c) && c >= 0 && c < 52) &&
  new Set(v).size === v.length;

export function isPhomMeld(cards: readonly number[]) {
  if (!cardsValid(cards) || cards.length < 3) return false;
  if (cards.length <= 4 && cards.every((c) => phomRank(c) === phomRank(cards[0]))) return true;
  const sorted = [...cards].sort((a, b) => phomRank(a) - phomRank(b));
  return sorted.every((c, i) => c % 4 === sorted[0] % 4 && (!i || phomRank(c) === phomRank(sorted[i - 1]) + 1));
}

/** Optimal non-overlapping partition; every eaten card must be in a meld, at most one eaten card per meld. */
export function solvePhom(hand: number[], eaten: number[] = []) {
  if (!cardsValid(hand) || !cardsValid(eaten) || hand.length > 10 || eaten.some((c) => !hand.includes(c)))
    throw new Error('INVALID_PLAY');
  const candidates: { mask: number; cards: number[] }[] = [];
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const cards = hand.filter((_, i) => mask & (1 << i));
    if (isPhomMeld(cards) && cards.filter((c) => eaten.includes(c)).length <= 1) candidates.push({ mask, cards });
  }
  const memo = new Map<number, { melds: number[][]; rubbish: number[]; points: number } | undefined>();

  function visit(available: number): { melds: number[][]; rubbish: number[]; points: number } | undefined {
    if (memo.has(available)) return memo.get(available);
    const rubbish = hand.filter((_, i) => available & (1 << i));
    let best: ReturnType<typeof visit> = rubbish.some((c) => eaten.includes(c))
      ? undefined
      : { melds: [], rubbish, points: rubbish.reduce((n, c) => n + phomRank(c), 0) };
    for (const candidate of candidates)
      if ((available & candidate.mask) === candidate.mask) {
        const rest = visit(available ^ candidate.mask);
        if (
          rest &&
          (!best ||
            rest.points < best.points ||
            (rest.points === best.points && rest.rubbish.length < best.rubbish.length))
        )
          best = { ...rest, melds: [candidate.cards, ...rest.melds] };
      }
    memo.set(available, best);
    return best;
  }

  const result = visit((1 << hand.length) - 1);
  if (!result) throw new Error('INVALID_PLAY');
  return result;
}

export function createPhomMatch(id: string, roomId: number, seed: number, tableId = 0): PhomMatch {
  return {
    id,
    roomId,
    tableId,
    seed: seed >>> 0,
    revision: 0,
    status: 'waiting',
    phase: 'discard',
    turn: 0,
    hands: [[], [], [], []],
    stock: [],
    discards: [[], [], [], []],
    eaten: [[], [], [], []],
    melds: [[], [], [], []],
    turns: [0, 0, 0, 0],
    laid: [false, false, false, false],
  };
}

function clonePhom(match: PhomMatch): PhomMatch {
  return {
    ...match,
    hands: match.hands.map((h) => [...h]),
    stock: [...match.stock],
    discards: match.discards.map((h) => [...h]),
    eaten: match.eaten.map((h) => [...h]),
    melds: match.melds.map((m) => m.map((h) => [...h])),
    turns: [...match.turns],
    laid: [...match.laid],
    session: match.session
      ? { ...match.session, coinDeltas: match.session.coinDeltas ? [...match.session.coinDeltas] : undefined }
      : undefined,
    last: match.last ? { ...match.last } : undefined,
    placements: match.placements ? [...match.placements] : undefined,
    scores: match.scores ? [...match.scores] : undefined,
    mom: match.mom ? [...match.mom] : undefined,
  };
}

export function phomSnapshot(match: PhomMatch): PhomSnapshot {
  const { hands, stock, seed: _seed, ...rest } = clonePhom(match);
  return {
    ...rest,
    hand: hands[0],
    counts: hands.map((h) => h.length),
    stockCount: stock.length,
    ...(match.status === 'finished' ? { finalHands: hands } : {}),
  };
}

export function canEatPhom(match: Pick<PhomSnapshot, 'hand' | 'eaten' | 'last' | 'phase' | 'turn'>) {
  if (match.phase !== 'receive' || !match.last || match.turn !== 0) return false;
  try {
    solvePhom([...match.hand, match.last.card], [...match.eaten[0], match.last.card]);
    return true;
  } catch {
    return false;
  }
}

export function phomSendTargets(match: Pick<PhomSnapshot, 'hand' | 'melds' | 'laid'>, sender = 0) {
  if (!match.melds[sender]?.length) return [];
  const targets: { card: number; seat: number; meld: number }[] = [];
  for (const card of match.hand)
    for (let seat = 0; seat < 4; seat++)
      if (match.laid[seat])
        for (let meld = 0; meld < match.melds[seat].length; meld++)
          if (isPhomMeld([...match.melds[seat][meld], card])) targets.push({ card, seat, meld });
  return targets;
}

function finish(match: PhomMatch, u?: number) {
  const count = match.session?.playerCount ?? 4;
  match.scores = match.hands.map((h, seat) =>
    match.laid[seat] ? h.reduce((n, c) => n + phomRank(c), 0) : solvePhom(h, match.eaten[seat]).points,
  );

  const mom = (seat: number) =>
    match.laid[seat]
      ? match.melds[seat].length === 0
      : solvePhom(match.hands[seat], match.eaten[seat]).melds.length === 0;

  match.mom = [0, 1, 2, 3].map(mom);
  match.placements = Array.from({ length: count }, (_, i) => i).sort((a, b) =>
    a === u ? -1 : b === u ? 1 : Number(mom(a)) - Number(mom(b)) || match.scores![a] - match.scores![b] || a - b,
  );
  match.winner = match.placements[0];
  match.u = u;
  match.status = 'finished';
}

function random(match: PhomMatch) {
  match.seed = (Math.imul(match.seed, 1664525) + 1013904223) >>> 0;
  return match.seed / 4294967296;
}

function act(match: PhomMatch, action: PhomAction) {
  const seat = match.turn,
    hand = match.hands[seat],
    count = match.session?.playerCount ?? 4;
  if (action.type === 'start') {
    if (match.status !== 'waiting') throw new Error('INVALID_TURN');
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) {
      const j = Math.floor(random(match) * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (let i = 0; i < count; i++) match.hands[i] = deck.splice(0, i === 0 ? 10 : 9).sort((a, b) => a - b);
    match.stock = deck;
    match.status = 'playing';
    match.turn = 0;
    match.phase = 'discard';
  } else {
    if (match.status !== 'playing') throw new Error('MATCH_FINISHED');
    if (action.type === 'draw' || action.type === 'eat') {
      if (match.phase !== 'receive') throw new Error('INVALID_TURN');
      if (action.type === 'eat') {
        if (!match.last) throw new Error('INVALID_PLAY');
        solvePhom([...hand, match.last.card], [...match.eaten[seat], match.last.card]);
        hand.push(match.last.card);
        match.eaten[seat].push(match.last.card);
        match.discards[match.last.seat].pop();
      } else {
        const card = match.stock.shift();
        if (card === undefined) throw new Error('INVALID_PLAY');
        hand.push(card);
      }
      delete match.last;
      hand.sort((a, b) => a - b);
      match.phase = match.turns[seat] === 3 ? 'lay' : 'discard';
    } else if (action.type === 'lay') {
      if (match.phase !== 'lay') throw new Error('INVALID_TURN');
      const solution = solvePhom(hand, match.eaten[seat]);
      match.melds[seat] = solution.melds;
      match.hands[seat] = solution.rubbish;
      match.laid[seat] = true;
      match.phase = 'send';
    } else if (action.type === 'send') {
      if (
        match.phase !== 'send' ||
        !match.melds[seat].length ||
        !hand.includes(action.card) ||
        !match.laid[action.seat] ||
        !match.melds[action.seat]?.[action.meld] ||
        !isPhomMeld([...match.melds[action.seat][action.meld], action.card])
      )
        throw new Error('INVALID_PLAY');
      hand.splice(hand.indexOf(action.card), 1);
      match.melds[action.seat][action.meld].push(action.card);
      if (!hand.length) {
        finish(match, seat);
        return;
      }
    } else if (action.type === 'done') {
      if (match.phase !== 'send') throw new Error('INVALID_TURN');
      match.phase = 'discard';
    } else {
      if (match.phase !== 'discard' || !hand.includes(action.card) || match.eaten[seat].includes(action.card))
        throw new Error('INVALID_PLAY');
      const remaining = hand.filter((c) => c !== action.card);
      if (!match.laid[seat]) solvePhom(remaining, match.eaten[seat]);
      match.hands[seat] = remaining;
      match.discards[seat].push(action.card);
      match.turns[seat]++;
      match.last = { card: action.card, seat };
      if (!remaining.length || (!match.laid[seat] && solvePhom(remaining, match.eaten[seat]).points === 0)) {
        finish(match, seat);
        return;
      }
      if (match.turns.slice(0, count).every((n) => n === 4)) {
        finish(match);
        return;
      }
      match.turn = (seat + 1) % count;
      match.phase = 'receive';
    }
  }
  if (
    match.status === 'playing' &&
    !match.laid[match.turn] &&
    match.hands[match.turn].length &&
    solvePhom(match.hands[match.turn], match.eaten[match.turn]).points === 0
  )
    finish(match, match.turn);
}

export function phomBotAction(match: PhomMatch): PhomAction {
  const seat = match.turn,
    hand = match.hands[seat],
    difficulty = match.session?.difficulty ?? 'medium';
  if (match.phase === 'receive') {
    try {
      if (match.last) {
        solvePhom([...hand, match.last.card], [...match.eaten[seat], match.last.card]);
        return { type: 'eat' };
      }
    } catch {}
    return { type: 'draw' };
  }
  if (match.phase === 'lay') return { type: 'lay' };
  if (match.phase === 'send') {
    const target = phomSendTargets({ ...phomSnapshot(match), hand }, seat)[0];
    return target ? { type: 'send', ...target } : { type: 'done' };
  }
  const legal = hand.filter((card) => {
    if (match.eaten[seat].includes(card)) return false;
    try {
      if (!match.laid[seat])
        solvePhom(
          hand.filter((c) => c !== card),
          match.eaten[seat],
        );
      return true;
    } catch {
      return false;
    }
  });
  if (!legal.length) throw new Error('INVALID_PLAY');
  if (difficulty === 'easy') return { type: 'discard', card: legal[Math.floor(random(match) * legal.length)] };

  const quality = (card: number) => {
    const remaining = hand.filter((c) => c !== card),
      solution = match.laid[seat]
        ? { points: remaining.reduce((n, c) => n + phomRank(c), 0), rubbish: remaining }
        : solvePhom(remaining, match.eaten[seat]);
    let value = solution.points * 10;
    if (difficulty === 'hard') {
      for (const c of solution.rubbish)
        for (const d of solution.rubbish)
          if (c < d && (phomRank(c) === phomRank(d) || (c % 4 === d % 4 && Math.abs(phomRank(c) - phomRank(d)) <= 2)))
            value -= 12;
      // Only public information: avoid feeding ranks/suits of the next seat's exposed melds.
      const next = (seat + 1) % (match.session?.playerCount ?? 4);
      if (match.melds[next].some((m) => isPhomMeld([...m, card]))) value += 20;
    }
    return value;
  };

  legal.sort((a, b) => quality(a) - quality(b) || phomRank(b) - phomRank(a));
  return { type: 'discard', card: legal[0] };
}

/** Only the caller acts; table games never advance other seats automatically. */
export function playPhomSeatAction(source: PhomMatch, seat: number, action: PhomAction) {
  if (source.status === 'finished') throw new Error('MATCH_FINISHED');
  if (seat !== source.turn) throw new Error('INVALID_TURN');
  const count = source.session?.playerCount ?? 4;
  if (action.type === 'send' && action.seat >= count) throw new Error('INVALID_PLAY');
  const state = clonePhom(source);
  const input = action.type === 'send' ? { ...action, seat: (action.seat + seat) % count } : action;
  act(state, input);
  state.revision++;
  return { state, step: { actor: seat, action: action.type, ...('card' in action ? { card: action.card } : {}) } };
}

/** Rotate public seat fields, exposing only the viewer's private hand. */
export function phomSeatSnapshot(match: PhomMatch, viewer: number): PhomSnapshot {
  const count = match.session?.playerCount ?? 4;

  const seat = (value: number) => (value - viewer + count) % count;

  const rotate = <T>(values: T[]) =>
    values.map((_, index) => (index < count ? values[(index + viewer) % count] : values[index]));

  const snapshot = phomSnapshot({ ...match, hands: rotate(match.hands) });
  return {
    ...snapshot,
    discards: rotate(snapshot.discards),
    eaten: rotate(snapshot.eaten),
    melds: rotate(snapshot.melds),
    turns: rotate(snapshot.turns),
    laid: rotate(snapshot.laid),
    turn: seat(snapshot.turn),
    last: snapshot.last && { ...snapshot.last, seat: seat(snapshot.last.seat) },
    placements: snapshot.placements?.map(seat),
    scores: snapshot.scores && rotate(snapshot.scores),
    mom: snapshot.mom && rotate(snapshot.mom),
    winner: snapshot.winner === undefined ? undefined : seat(snapshot.winner),
    u: snapshot.u === undefined ? undefined : seat(snapshot.u),
    finalHands: snapshot.finalHands && rotate(snapshot.finalHands),
    session: snapshot.session && {
      ...snapshot.session,
      coinDeltas: snapshot.session.coinDeltas && rotate(snapshot.session.coinDeltas),
      coinDelta: snapshot.session.coinDeltas?.[viewer] ?? snapshot.session.coinDelta,
    },
  };
}

export function playPhomAction(source: PhomMatch, action: PhomAction): { state: PhomMatch; result: PhomResult } {
  if (source.status === 'finished') throw new Error('MATCH_FINISHED');
  if (source.turn !== 0) throw new Error('INVALID_TURN');
  const state = clonePhom(source),
    steps: PhomResult['steps'] = [];

  function apply(input: PhomAction) {
    const actor = state.turn;
    act(state, input);
    steps.push({
      actor,
      action: input.type,
      ...('card' in input ? { card: input.card } : {}),
      match: phomSnapshot(state),
    });
  }

  apply(action);
  for (let i = 0; state.status === 'playing' && state.turn !== 0; i++) {
    if (i > 80) throw new Error('INVALID_TURN');
    apply(phomBotAction(state));
  }
  state.revision++;
  return { state, result: { match: phomSnapshot(state), steps } };
}

export function isPhomSnapshot(value: unknown): value is PhomSnapshot {
  const m = value as PhomSnapshot;
  return (
    !!m &&
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    validSavedArcadeSeat(m.roomId, m.tableId) &&
    Number.isSafeInteger(m.revision) &&
    m.revision >= 0 &&
    ['waiting', 'playing', 'finished'].includes(m.status) &&
    ['receive', 'discard', 'lay', 'send'].includes(m.phase) &&
    Number.isInteger(m.turn) &&
    m.turn >= 0 &&
    m.turn < (m.session?.playerCount ?? 4) &&
    (!m.session || validArcadeSession(m.session)) &&
    cardsValid(m.hand) &&
    m.hand.length <= 10 &&
    Number.isInteger(m.stockCount) &&
    m.stockCount >= 0 &&
    m.stockCount <= 52 &&
    Array.isArray(m.counts) &&
    m.counts.length === 4 &&
    m.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 10) &&
    m.counts[0] === m.hand.length &&
    [m.discards, m.eaten].every((a) => Array.isArray(a) && a.length === 4 && a.every(cardsValid)) &&
    Array.isArray(m.melds) &&
    m.melds.length === 4 &&
    m.melds.every((a) => Array.isArray(a) && a.every(isPhomMeld)) &&
    Array.isArray(m.turns) &&
    m.turns.length === 4 &&
    m.turns.every((n) => Number.isInteger(n) && n >= 0 && n <= 4) &&
    Array.isArray(m.laid) &&
    m.laid.length === 4 &&
    m.laid.every((v) => typeof v === 'boolean') &&
    (m.u === undefined || (Number.isInteger(m.u) && m.u >= 0 && m.u < (m.session?.playerCount ?? 4))) &&
    (m.finalHands === undefined ||
      (Array.isArray(m.finalHands) && m.finalHands.length === 4 && m.finalHands.every(cardsValid))) &&
    (!m.last ||
      (cardsValid([m.last.card]) &&
        Number.isInteger(m.last.seat) &&
        m.last.seat >= 0 &&
        m.last.seat < 4 &&
        m.discards[m.last.seat].at(-1) === m.last.card)) &&
    (m.status !== 'finished' ||
      (Array.isArray(m.mom) &&
        m.mom.length === 4 &&
        m.mom.every((v) => typeof v === 'boolean') &&
        Array.isArray(m.placements) &&
        m.placements.length === (m.session?.playerCount ?? 4) &&
        new Set(m.placements).size === m.placements.length &&
        m.placements.every((n) => Number.isInteger(n) && n >= 0 && n < (m.session?.playerCount ?? 4)) &&
        m.winner === m.placements[0] &&
        Array.isArray(m.scores) &&
        m.scores.length === 4 &&
        m.scores.every((n) => Number.isInteger(n) && n >= 0 && n <= 130)))
  );
}

export function isPhomMatch(value: unknown): value is PhomMatch {
  try {
    const m = value as PhomMatch;
    if (
      !m ||
      !Array.isArray(m.hands) ||
      m.hands.length !== 4 ||
      !m.hands.every(cardsValid) ||
      !cardsValid(m.stock) ||
      !Number.isInteger(m.seed) ||
      m.seed < 0 ||
      m.seed > 4294967295
    )
      return false;
    if (!isPhomSnapshot(phomSnapshot(m))) return false;
    const all = [...m.hands.flat(), ...m.stock, ...m.discards.flat(), ...m.melds.flat(2)];
    return (
      new Set(all).size === all.length &&
      (m.status === 'waiting' ? all.length === 0 : all.length === 52) &&
      m.eaten.every((e, seat) =>
        e.every((c) => m.hands[seat].includes(c) || m.melds[seat].some((meld) => meld.includes(c))),
      )
    );
  } catch {
    return false;
  }
}
