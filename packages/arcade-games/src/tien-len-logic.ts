import { validSavedArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { type ArcadeSession, validArcadeSession } from './session.js';
import type { TableSnapshot } from './table-snapshot.js';
/** Southern-style free practice. Card IDs: ranks 3..A,2; suits spades, clubs, diamonds, hearts. */
export type Card = number;
export type TienCombo = {
  kind: 'single' | 'pair' | 'triple' | 'quad' | 'straight' | 'pairs3' | 'pairs4';
  cards: Card[];
  high: number;
};
export type TienAction = { type: 'start' } | { type: 'play'; cards: Card[] } | { type: 'pass' };
export type TienMatch = {
  id: string;
  roomId: number;
  tableId?: number;
  session?: ArcadeSession;
  seed: number;
  revision: number;
  status: 'waiting' | 'playing' | 'finished';
  hands: Card[][];
  undealt?: Card[];
  played: Card[];
  turn: number;
  opening: boolean;
  openingCard?: Card;
  pile?: TienCombo;
  lastPlayer?: number;
  passed: number[];
  winner?: number;
  placements?: number[];
};
export type TienSnapshot = Omit<TienMatch, 'hands' | 'seed' | 'undealt'> & {
  hand: Card[];
  counts: number[];
  undealtCount?: number;
  /** People at the table in seat order, viewer first. Absent when the other seats are bots. */
  lastSteps?: { revision: number; steps: TienResult['steps'][number][] };
  serverTime?: number;
  turnEndsAt?: number;
  players?: TableSnapshot<never>['players'];
};
export type TienResult = {
  match: TienSnapshot;
  steps: { actor: number; action: TienAction['type']; cards: Card[]; match: TienSnapshot }[];
};

export const cardRank = (card: Card) => Math.floor(card / 4);

export const cardSuit = (card: Card) => card % 4;

export function tienCombo(input: readonly Card[]): TienCombo | undefined {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > 13 ||
    input.some((c) => !Number.isSafeInteger(c) || c < 0 || c >= 52) ||
    new Set(input).size !== input.length
  )
    return;
  const cards = [...input].sort((a, b) => a - b),
    high = cards[cards.length - 1];
  const ranks = cards.map(cardRank);
  const unique = [...new Set(ranks)];
  let kind: TienCombo['kind'] | undefined;
  if (cards.length === 1) kind = 'single';
  else if (unique.length === 1 && cards.length <= 4)
    kind = cards.length === 2 ? 'pair' : cards.length === 3 ? 'triple' : 'quad';
  else if (ranks[ranks.length - 1] < 12) {
    const consecutive = unique.every((rank, i) => i === 0 || rank === unique[i - 1] + 1);
    if (consecutive && unique.length === cards.length && cards.length >= 3) kind = 'straight';
    else if (
      consecutive &&
      [6, 8].includes(cards.length) &&
      unique.length * 2 === cards.length &&
      unique.every((rank) => ranks.filter((r) => r === rank).length === 2)
    )
      kind = cards.length === 6 ? 'pairs3' : 'pairs4';
  }
  return kind ? { kind, cards, high } : undefined;
}

export function beatsTien(candidate: TienCombo, pile?: TienCombo) {
  if (!pile) return true;
  if (candidate.kind === pile.kind && candidate.cards.length === pile.cards.length) return candidate.high > pile.high;
  const two = cardRank(pile.high) === 12;
  if (candidate.kind === 'pairs3') return pile.kind === 'single' && two;
  if (candidate.kind === 'quad') return (two && ['single', 'pair'].includes(pile.kind)) || pile.kind === 'pairs3';
  if (candidate.kind === 'pairs4')
    return (two && ['single', 'pair'].includes(pile.kind)) || ['pairs3', 'quad'].includes(pile.kind);
  return false;
}

export function legalTienPlays(hand: readonly Card[], pile?: TienCombo, opening = false, openingCard = 0): TienCombo[] {
  const moves: TienCombo[] = [];
  for (let mask = 1; mask < 2 ** hand.length; mask++) {
    const cards = hand.filter((_, i) => mask & (1 << i));
    if (opening && !cards.includes(openingCard)) continue;
    const combo = tienCombo(cards);
    if (combo && beatsTien(combo, pile)) moves.push(combo);
  }
  return moves.sort((a, b) => a.cards.length - b.cards.length || a.high - b.high);
}

export function createTienMatch(id: string, roomId: number, seed: number, tableId = 0): TienMatch {
  return {
    id,
    roomId,
    tableId,
    seed: seed >>> 0,
    revision: 0,
    status: 'waiting',
    hands: [[], [], [], []],
    played: [],
    turn: 0,
    opening: true,
    passed: [],
  };
}

export function tienSnapshot(match: TienMatch): TienSnapshot {
  const { hands, seed: _seed, undealt, ...rest } = match;
  return {
    ...rest,
    session: rest.session ? { ...rest.session } : undefined,
    played: [...rest.played],
    passed: [...rest.passed],
    placements: rest.placements ? [...rest.placements] : undefined,
    pile: rest.pile ? { ...rest.pile, cards: [...rest.pile.cards] } : undefined,
    hand: [...hands[0]],
    counts: hands.map((h) => h.length),
    undealtCount: undealt?.length,
  };
}

function deal(match: TienMatch) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    match.seed = (Math.imul(match.seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((match.seed / 4294967296) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const count = match.session?.playerCount ?? 4;
  match.hands = Array.from({ length: 4 }, (_, seat) =>
    seat < count ? deck.slice(seat * 13, seat * 13 + 13).sort((a, b) => a - b) : [],
  );
  match.undealt = deck.slice(count * 13);
  match.openingCard = Math.min(...match.hands.flat());
  match.turn = match.hands.findIndex((hand) => hand.includes(match.openingCard!));
  match.status = 'playing';
}

function act(match: TienMatch, actor: number, action: TienAction, steps: TienResult['steps']) {
  if (match.status !== 'playing' || actor !== match.turn) throw new Error('INVALID_TURN');
  let cards: Card[] = [];
  if (action.type === 'play') {
    const combo = tienCombo(action.cards);
    if (
      !combo ||
      !action.cards.every((card) => match.hands[actor].includes(card)) ||
      (match.opening && !action.cards.includes(match.openingCard ?? 0)) ||
      !beatsTien(combo, match.pile)
    )
      throw new Error('INVALID_PLAY');
    cards = combo.cards;
    match.hands[actor] = match.hands[actor].filter((card) => !cards.includes(card));
    match.played.push(...cards);
    match.pile = combo;
    match.lastPlayer = actor;
    match.opening = false;
    if (!match.hands[actor].length) {
      match.winner ??= actor;
      if (match.session?.payoutRule) {
        match.placements ??= [];
        match.placements.push(actor);
        if (match.session.playerCount === 2) match.placements.push(actor === 0 ? 1 : 0);
        if (match.placements.length === 2) match.status = 'finished';
      } else match.status = 'finished';
    }
  } else if (action.type === 'pass') {
    if (!match.pile) throw new Error('CANNOT_PASS');
    match.passed.push(actor);
  } else throw new Error('INVALID_PLAY');
  if (match.status === 'playing') {
    let next: number | undefined;
    for (let offset = 1; offset <= 4; offset++) {
      const candidate = (actor + offset) % 4;
      if (match.hands[candidate].length && !match.passed.includes(candidate)) {
        next = candidate;
        break;
      }
    }
    if (next === undefined || next === match.lastPlayer) {
      const leader = match.lastPlayer ?? actor;
      match.turn = match.hands[leader].length
        ? leader
        : [1, 2, 3].map((offset) => (leader + offset) % 4).find((seat) => match.hands[seat].length)!;
      match.pile = undefined;
      match.passed = [];
      match.lastPlayer = undefined;
    } else match.turn = next;
  }
  steps.push({ actor, action: action.type, cards, match: tienSnapshot(match) });
}

function cloneTien(source: TienMatch): TienMatch {
  return {
    ...source,
    session: source.session ? { ...source.session } : undefined,
    hands: source.hands.map((h) => [...h]),
    undealt: source.undealt ? [...source.undealt] : undefined,
    played: [...source.played],
    passed: [...source.passed],
    placements: source.placements ? [...source.placements] : undefined,
    pile: source.pile ? { ...source.pile, cards: [...source.pile.cards] } : undefined,
  };
}

/**
 * The match as one seat sees it at a table of people: seats are renumbered so the viewer is seat 0, which is
 * what `TienSnapshot` consumers assume, and only the viewer's hand is included.
 */
export function tienSeatSnapshot(match: TienMatch, viewer: number): TienSnapshot {
  const count = match.session?.playerCount ?? 4;

  const seat = (value: number) => (value < count ? (value - viewer + count) % count : value);

  const turned = <T>(values: readonly T[], empty: T) =>
    Array.from({ length: values.length }, (_, index) => (index < count ? values[(index + viewer) % count] : empty));

  const snapshot = tienSnapshot({ ...match, hands: turned(match.hands, []) });
  return {
    ...snapshot,
    turn: seat(snapshot.turn),
    lastPlayer: snapshot.lastPlayer === undefined ? undefined : seat(snapshot.lastPlayer),
    passed: snapshot.passed.map(seat),
    winner: snapshot.winner === undefined ? undefined : seat(snapshot.winner),
    placements: snapshot.placements?.map(seat),
    session: snapshot.session && {
      ...snapshot.session,
      coinDeltas: snapshot.session.coinDeltas && turned(snapshot.session.coinDeltas, 0),
      coinDelta: snapshot.session.coinDeltas ? snapshot.session.coinDeltas[viewer] : snapshot.session.coinDelta,
    },
  };
}

/** One action by one seat at a table of people; no seat is ever played automatically. */
export function playTienSeatAction(source: TienMatch, seat: number, action: TienAction) {
  const state = cloneTien(source);
  const steps: TienResult['steps'] = [];
  if (action.type === 'start') {
    if (state.status !== 'waiting') throw new Error('INVALID_TURN');
    deal(state);
  } else {
    if (state.status === 'finished') throw new Error('MATCH_FINISHED');
    act(state, seat, action, steps);
  }
  state.revision++;
  return { state, step: { actor: seat, action: action.type, cards: steps[0]?.cards ?? [] } };
}

export function playTienAction(source: TienMatch, action: TienAction): { state: TienMatch; result: TienResult } {
  const state = cloneTien(source);
  const steps: TienResult['steps'] = [];
  if (action.type === 'start') {
    if (state.status !== 'waiting') throw new Error('INVALID_TURN');
    deal(state);
    steps.push({ actor: 0, action: 'start', cards: [], match: tienSnapshot(state) });
  } else {
    if (state.status === 'finished') throw new Error('MATCH_FINISHED');
    act(state, 0, action, steps);
  }
  let turns = 0;
  while (state.status === 'playing' && (state.turn !== 0 || state.placements?.includes(0))) {
    if (++turns > 200) throw new Error('INVALID_TURN');
    const actor = state.turn,
      moves = legalTienPlays(state.hands[actor], state.pile, state.opening, state.openingCard ?? 0);
    // Lead with a long run to shed cards; respond with the smallest legal combination.
    const difficulty = state.session?.difficulty ?? 'medium';
    let move: TienCombo | undefined;
    if (difficulty === 'easy') {
      state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
      move = moves[Math.floor((state.seed / 4294967296) * moves.length)];
    } else if (difficulty === 'hard') {
      const threatened = state.hands.some((hand, seat) => seat !== actor && hand.length > 0 && hand.length <= 3);

      const value = (candidate: TienCombo) => {
        const remaining = state.hands[actor].filter((card) => !candidate.cards.includes(card));
        const counts = new Map<number, number>();
        for (const card of remaining) counts.set(cardRank(card), (counts.get(cardRank(card)) ?? 0) + 1);
        const singles = [...counts.values()].filter((count) => count === 1).length;
        return candidate.cards.length === state.hands[actor].length
          ? 10000
          : candidate.cards.length * (threatened || !state.pile ? 100 : 10) - singles * 8 - candidate.high / 52;
      };

      move = moves.sort((a, b) => value(b) - value(a))[0];
    } else move = state.pile ? moves[0] : moves.sort((a, b) => b.cards.length - a.cards.length || a.high - b.high)[0];
    act(state, actor, move ? { type: 'play', cards: move.cards } : { type: 'pass' }, steps);
  }
  state.revision++;
  return { state, result: { match: tienSnapshot(state), steps } };
}

export function isTienSnapshot(value: unknown): value is TienSnapshot {
  const m = value as TienSnapshot;

  const cardList = (v: unknown): v is Card[] =>
    Array.isArray(v) && v.every((c) => Number.isSafeInteger(c) && c >= 0 && c < 52) && new Set(v).size === v.length;

  const seat = (s: unknown) => Number.isSafeInteger(s) && Number(s) >= 0 && Number(s) < 4;

  return (
    !!m &&
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    m.id.length <= 100 &&
    validSavedArcadeSeat(m.roomId, m.tableId) &&
    (m.session === undefined || validArcadeSession(m.session)) &&
    Number.isSafeInteger(m.revision) &&
    m.revision >= 0 &&
    ['waiting', 'playing', 'finished'].includes(m.status) &&
    seat(m.turn) &&
    typeof m.opening === 'boolean' &&
    (m.openingCard === undefined || (Number.isInteger(m.openingCard) && m.openingCard >= 0 && m.openingCard < 52)) &&
    (m.undealtCount === undefined ||
      (Number.isInteger(m.undealtCount) && m.undealtCount >= 0 && m.undealtCount <= 26)) &&
    cardList(m.hand) &&
    m.hand.length <= 13 &&
    cardList(m.played) &&
    !m.hand.some((c) => m.played.includes(c)) &&
    Array.isArray(m.counts) &&
    m.counts.length === 4 &&
    m.counts.every((c) => Number.isSafeInteger(c) && c >= 0 && c <= 13) &&
    m.counts[0] === m.hand.length &&
    m.counts.every((count, seat) => seat < (m.session?.playerCount ?? 4) || count === 0) &&
    cardList(m.passed) &&
    m.passed.length <= 3 &&
    m.passed.every(seat) &&
    (m.lastPlayer === undefined || seat(m.lastPlayer)) &&
    (m.pile === undefined ||
      (!!m.pile && !!tienCombo(m.pile.cards) && JSON.stringify(tienCombo(m.pile.cards)) === JSON.stringify(m.pile))) &&
    (m.winner === undefined || seat(m.winner)) &&
    (m.placements === undefined ||
      (Array.isArray(m.placements) &&
        m.placements.length <= 2 &&
        new Set(m.placements).size === m.placements.length &&
        m.placements.every(
          (s, rank) =>
            seat(s) &&
            s < (m.session?.playerCount ?? 4) &&
            (m.counts[s] === 0 || (m.session?.playerCount === 2 && rank === 1)),
        ) &&
        (m.placements.length === 0 || m.winner === m.placements[0]) &&
        (m.status !== 'finished' || m.placements.length === 2))) &&
    (!m.session?.payoutRule || m.status !== 'finished' || m.placements?.length === 2) &&
    (m.status === 'waiting' || (m.undealtCount ?? 0) === 13 * (4 - (m.session?.playerCount ?? 4))) &&
    (m.status === 'waiting'
      ? m.played.length === 0 && m.counts.every((c) => c === 0)
      : m.counts.reduce((a, b) => a + b, 0) + m.played.length + (m.undealtCount ?? 0) === 52) &&
    (m.status !== 'finished' || (m.winner !== undefined && m.counts[m.winner] === 0))
  );
}

export function isTienMatch(value: unknown): value is TienMatch {
  const m = value as TienMatch;
  if (
    !m ||
    !Array.isArray(m.hands) ||
    m.hands.length !== 4 ||
    !m.hands.every((h) => Array.isArray(h) && h.every((c) => Number.isSafeInteger(c) && c >= 0 && c < 52)) ||
    !Array.isArray(m.played) ||
    !Array.isArray(m.passed) ||
    !Number.isSafeInteger(m.seed) ||
    m.seed < 0 ||
    m.seed > 4294967295
  )
    return false;
  if (
    m.undealt !== undefined &&
    (!Array.isArray(m.undealt) || m.undealt.some((c) => !Number.isInteger(c) || c < 0 || c >= 52))
  )
    return false;
  const cards = [...m.hands.flat(), ...m.played, ...(m.undealt ?? [])];
  return (
    new Set(cards).size === cards.length &&
    m.hands.every((h) => h.length <= 13) &&
    isTienSnapshot({ ...m, hand: m.hands[0], counts: m.hands.map((h) => h.length), undealtCount: m.undealt?.length })
  );
}
