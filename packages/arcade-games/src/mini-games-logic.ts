import { validArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { chessBoard, chessSquare, chooseChessMove, legalChessMoves, loadChess } from './chess-logic.js';
import { isRandomSeed, normalizeSeed, type RandomSeed, random } from './random.js';
import { type ArcadeSession, validArcadeSession } from './session.js';
import type { TableSnapshot } from './table-snapshot.js';
import {
  applyXiangqiMove,
  type BoardMove,
  chooseXiangqiMove,
  createXiangqiBoard,
  isLegalXiangqiMove,
  legalXiangqiMoves,
  validXiangqiBoard,
  xiangqiInCheck,
} from './xiangqi-logic.js';
export const MINI_GAME_IDS = ['bau-cua', 'slots', 'chess', 'chinese-chess'] as const;
export type MiniGameId = (typeof MINI_GAME_IDS)[number];
export type MiniAction =
  | { type: 'start' | 'spin' | 'resign' | 'next-round' }
  | { type: 'roll'; symbol: number }
  | ({ type: 'move' } & BoardMove);
export type MiniMatch = {
  id: string;
  gameId: MiniGameId;
  roomId: number;
  tableId: number;
  session?: ArcadeSession;
  revision: number;
  seed: RandomSeed;
  status: 'waiting' | 'playing' | 'finished';
  board: (string | null)[];
  moves: (BoardMove & { check?: boolean })[];
  history: string[];
  turn: 0 | 1;
  roll?: number[];
  choice?: number;
  multiplier?: number;
  outcome?: 'win' | 'loss' | 'draw';
  reason?:
    | 'checkmate'
    | 'stalemate'
    | 'draw'
    | 'repetition'
    | 'perpetual-check'
    | 'turn-limit'
    | 'resign'
    | 'roll'
    | 'spin';
  check?: boolean;
  quiet: number;
};
export interface MiniSnapshot extends Omit<MiniMatch, 'seed'>, TableSnapshot<MiniSnapshot> {
  side?: 0 | 1;
}
export type MiniResult = { match: MiniSnapshot; steps: MiniSnapshot[] };

export function isMiniGameId(v: unknown): v is MiniGameId {
  return MINI_GAME_IDS.includes(v as MiniGameId);
}

export function createMiniMatch(
  gameId: MiniGameId,
  id: string,
  roomId: number,
  seed: RandomSeed,
  tableId = 0,
): MiniMatch {
  return {
    id,
    gameId,
    roomId,
    tableId,
    seed: normalizeSeed(seed),
    revision: 0,
    status: 'waiting',
    board: [],
    moves: [],
    history: [],
    turn: 0,
    quiet: 0,
  };
}

const clone = (m: MiniMatch): MiniMatch => ({
  ...m,
  board: [...m.board],
  moves: m.moves.map((v) => ({ ...v })),
  history: [...m.history],
  roll: m.roll ? [...m.roll] : undefined,
  session: m.session ? { ...m.session } : undefined,
});

export function miniSnapshot(m: MiniMatch): MiniSnapshot {
  const { seed: _seed, ...snapshot } = clone(m);
  return snapshot;
}

const key = (board: (string | null)[], turn: number) => `${turn}:${board.map((p) => p ?? '.').join(',')}`;

export function legalMiniMoves(m: MiniSnapshot): BoardMove[] {
  if (m.status !== 'playing') return [];
  return m.gameId === 'chess'
    ? legalChessMoves(loadChess(m.moves))
    : m.gameId === 'chinese-chess'
      ? legalXiangqiMoves(m.board, m.turn === 0 ? 'r' : 'b')
      : [];
}

function end(m: MiniMatch, outcome: MiniMatch['outcome'], reason: MiniMatch['reason']) {
  m.status = 'finished';
  m.outcome = outcome;
  m.reason = reason;
}

function chessTurn(m: MiniMatch, move: BoardMove) {
  const c = loadChess(m.moves);
  c.move({ from: chessSquare(move.from), to: chessSquare(move.to), promotion: move.promotion ?? 'q' });
  m.moves.push({ ...move });
  m.board = chessBoard(c);
  m.turn = c.turn() === 'w' ? 0 : 1;
  m.check = c.isCheck();
  if (c.isCheckmate()) end(m, m.turn === 0 ? 'loss' : 'win', 'checkmate');
  else if (c.isDraw()) end(m, 'draw', c.isStalemate() ? 'stalemate' : 'draw');
  else if (m.moves.length >= 300) end(m, 'draw', 'turn-limit');
}

function xiangqiTurn(m: MiniMatch, move: BoardMove) {
  const side = m.turn === 0 ? 'r' : 'b';
  if (!legalXiangqiMoves(m.board, side).some((v) => v.from === move.from && v.to === move.to))
    throw new Error('INVALID_PLAY');
  const captured = m.board[move.to];
  const pawn = m.board[move.from]?.[1] === 'p';
  m.board = applyXiangqiMove(m.board, move);
  m.turn = m.turn === 0 ? 1 : 0;
  m.check = xiangqiInCheck(m.board, m.turn === 0 ? 'r' : 'b');
  m.moves.push({ ...move, check: m.check });
  m.quiet = captured || pawn ? 0 : m.quiet + 1;
  m.history.push(key(m.board, m.turn));
  if (!legalXiangqiMoves(m.board, m.turn === 0 ? 'r' : 'b').length) {
    end(m, m.turn === 0 ? 'loss' : 'win', m.check ? 'checkmate' : 'stalemate');
    return;
  }
  const repeated = m.history.map((v, i) => (v === m.history.at(-1) ? i : -1)).filter((i) => i >= 0);
  if (repeated.length >= 3) {
    const start = repeated.at(-3)!;
    const cycle = m.moves.slice(start);

    const allCheck = (seat: number) =>
      cycle.filter((_, i) => (start + i) % 2 === seat).length > 0 &&
      cycle.filter((_, i) => (start + i) % 2 === seat).every((v) => v.check);

    if (allCheck(0) !== allCheck(1)) end(m, allCheck(0) ? 'loss' : 'win', 'perpetual-check');
    else end(m, 'draw', 'repetition');
  } else if (m.quiet >= 120 || m.moves.length >= 300) end(m, 'draw', 'turn-limit');
}

/** Board coordinates and colors stay absolute; outcomes are relative to the viewer. */
export function miniSeatSnapshot(source: MiniMatch, viewer: number): MiniSnapshot {
  const m = miniSnapshot(source);
  const chance = m.gameId === 'bau-cua' || m.gameId === 'slots';
  const member = m.session?.members?.[viewer];
  const count = m.session?.members?.length ?? 2;
  const hits = m.roll?.filter((symbol) => symbol === member?.choice).length;
  return {
    ...m,
    side: chance ? undefined : (viewer as 0 | 1),
    ...(chance
      ? { choice: member?.choice, multiplier: m.gameId === 'bau-cua' && hits !== undefined ? hits : m.multiplier }
      : {}),
    outcome: chance
      ? m.status === 'finished'
        ? (m.gameId === 'bau-cua' ? hits : m.multiplier)
          ? 'win'
          : 'loss'
        : undefined
      : viewer === 1 && m.outcome !== 'draw'
        ? m.outcome === 'win'
          ? 'loss'
          : m.outcome === 'loss'
            ? 'win'
            : undefined
        : m.outcome,
    session: m.session && {
      ...m.session,
      coinDelta: m.session.coinDeltas?.[viewer] ?? m.session.coinDelta,
      coinDeltas:
        m.session.coinDeltas &&
        (chance
          ? m.session.coinDeltas.map((_, index) =>
              index < count ? m.session!.coinDeltas![(index + viewer) % count] : 0,
            )
          : viewer === 1
            ? [m.session.coinDeltas[1], m.session.coinDeltas[0], 0, 0]
            : [...m.session.coinDeltas]),
    },
  };
}

export function playMiniSeatAction(source: MiniMatch, seat: number, action: MiniAction) {
  if (source.gameId === 'bau-cua' || source.gameId === 'slots') {
    if (seat !== 0) throw new Error('INVALID_TURN');
    const { state } = playMiniAction(source, action);
    if (action.type === 'next-round' && state.session)
      state.session.members = state.session.members?.map((member) => ({ ...member, ready: false }));
    return { state };
  }
  if (source.status === 'finished') throw new Error('MATCH_FINISHED');
  const m = clone(source);
  if (action.type === 'start') {
    if (seat !== 0 || m.status !== 'waiting') throw new Error('INVALID_TURN');
    m.status = 'playing';
    if (m.gameId === 'chess') m.board = chessBoard(loadChess([]));
    else if (m.gameId === 'chinese-chess') {
      m.board = createXiangqiBoard();
      m.history = [key(m.board, 0)];
    } else throw new Error('INVALID_PLAY');
  } else {
    if (m.status !== 'playing') throw new Error('INVALID_TURN');
    if (action.type === 'resign') end(m, seat === 0 ? 'loss' : 'win', 'resign');
    else {
      if (seat !== m.turn) throw new Error('INVALID_TURN');
      if (
        action.type !== 'move' ||
        !legalMiniMoves(m).some(
          (v) => v.from === action.from && v.to === action.to && (v.promotion ?? 'q') === (action.promotion ?? 'q'),
        )
      )
        throw new Error('INVALID_PLAY');
      if (m.gameId === 'chess') chessTurn(m, action);
      else xiangqiTurn(m, action);
    }
  }
  m.revision++;
  return { state: m };
}

export function playMiniAction(source: MiniMatch, action: MiniAction): { state: MiniMatch; result: MiniResult } {
  const m = clone(source),
    steps: MiniSnapshot[] = [];
  const chance = m.gameId === 'bau-cua' || m.gameId === 'slots';
  if (action.type === 'next-round') {
    if (!chance || source.status !== 'finished') throw new Error('INVALID_PLAY');
    m.status = 'waiting';
    m.outcome = undefined;
    m.reason = undefined;
    m.multiplier = undefined;
    m.roll = undefined;
    m.choice = undefined;
    if (m.session) {
      m.session = {
        ...m.session,
        configured: false,
        settled: false,
        housePayouts: undefined,
        coinDelta: undefined,
        coinDeltas: undefined,
        members: m.session.members?.map((member) => ({ ...member, ready: member.id !== m.session!.hostId })),
      };
    }
    m.revision++;
    const snapshot = miniSnapshot(m);
    return { state: m, result: { match: snapshot, steps: [snapshot] } };
  }
  if (chance && m.status === 'waiting' && m.session?.configured && (action.type === 'roll' || action.type === 'spin'))
    m.status = 'playing';
  if (source.status === 'finished') throw new Error('MATCH_FINISHED');
  if (source.turn !== 0) throw new Error('INVALID_TURN');
  if (action.type === 'start') {
    if (m.status !== 'waiting') throw new Error('INVALID_TURN');
    m.status = 'playing';
    if (m.gameId === 'chess') m.board = chessBoard(loadChess([]));
    else if (m.gameId === 'chinese-chess') {
      m.board = createXiangqiBoard();
      m.history = [key(m.board, 0)];
    }
  } else {
    if (m.status !== 'playing') throw new Error('INVALID_TURN');
    if (action.type === 'resign') {
      if (chance) throw new Error('INVALID_PLAY');
      end(m, 'loss', 'resign');
    } else if (action.type === 'roll' && m.gameId === 'bau-cua') {
      if (!Number.isInteger(action.symbol) || action.symbol < 0 || action.symbol > 5) throw new Error('INVALID_PLAY');
      const savedChoice = m.session?.members?.find((member) => member.id === m.session?.hostId)?.choice ?? m.choice;
      if (savedChoice !== undefined && action.symbol !== savedChoice) throw new Error('INVALID_PLAY');
      m.choice = savedChoice ?? action.symbol;
      m.roll = Array.from({ length: 3 }, () => Math.floor(random(m) * 6));
      m.multiplier = m.roll.filter((v) => v === m.choice).length;
      end(m, m.multiplier ? 'win' : 'loss', 'roll');
    } else if (action.type === 'spin' && m.gameId === 'slots') {
      m.roll = Array.from({ length: 3 }, () => Math.floor(random(m) * 6));
      m.multiplier = m.roll.every((v) => v === m.roll![0])
        ? m.roll[0] === 5
          ? 10
          : 5
        : new Set(m.roll).size === 2
          ? 2
          : 0;
      end(m, m.multiplier ? 'win' : 'loss', 'spin');
    } else if (action.type === 'move' && (m.gameId === 'chess' || m.gameId === 'chinese-chess')) {
      if (
        !legalMiniMoves(m).some(
          (v) => v.from === action.from && v.to === action.to && (v.promotion ?? 'q') === (action.promotion ?? 'q'),
        )
      )
        throw new Error('INVALID_PLAY');
      if (m.gameId === 'chess') chessTurn(m, action);
      else xiangqiTurn(m, action);
      steps.push(miniSnapshot(m));
      if (m.status === 'playing') {
        const bot =
          m.gameId === 'chess'
            ? chooseChessMove(loadChess(m.moves), m.session?.difficulty ?? 'medium', random(m))
            : chooseXiangqiMove(m.board, 'b', m.session?.difficulty ?? 'medium', random(m));
        if (m.gameId === 'chess') chessTurn(m, bot);
        else xiangqiTurn(m, bot);
      }
    } else throw new Error('INVALID_PLAY');
  }
  m.revision++;
  steps.push(miniSnapshot(m));
  return { state: m, result: { match: miniSnapshot(m), steps } };
}

export function miniCoinDelta(m: MiniSnapshot) {
  if (m.status !== 'finished' || m.session?.mode !== 'wager') return 0;
  const stake = m.session.stake;
  if ((m.gameId === 'slots' || m.gameId === 'bau-cua') && (!m.roll || !['roll', 'spin'].includes(m.reason ?? '')))
    return 0;
  if (m.gameId === 'slots') return stake * ((m.multiplier ?? 0) - 1);
  if (m.gameId === 'bau-cua') return m.multiplier ? stake * m.multiplier : -stake;
  return m.outcome === 'draw' ? 0 : m.outcome === 'win' ? stake : -stake;
}

/** House games settle each bet independently; their deltas need not sum to zero. */
export function miniMemberCoinDeltas(m: MiniSnapshot): { memberId: string; delta: number }[] {
  if (!m.session || !m.roll || m.status !== 'finished' || !['roll', 'spin'].includes(m.reason ?? '')) return [];
  const members = m.session.members ?? [
    { id: m.session.hostId, ready: true, stake: m.session.stake, choice: m.choice },
  ];
  return members.map((member) => {
    const stake = member.stake ?? m.session!.stake;
    const hits = m.roll!.filter((symbol) => symbol === (member.choice ?? m.choice ?? 0)).length;
    const delta =
      m.session!.mode !== 'wager' || stake === 0
        ? 0
        : m.gameId === 'bau-cua'
          ? stake * (hits || -1)
          : m.gameId === 'slots'
            ? stake * ((m.multiplier ?? 0) - 1)
            : 0;
    if (!Number.isSafeInteger(delta)) throw new Error('INVALID_PAYOUT');
    return { memberId: member.id, delta };
  });
}

export function isMiniSnapshot(v: unknown): v is MiniSnapshot {
  const m = v as MiniSnapshot;
  return (
    !!m &&
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    m.id.length <= 100 &&
    isMiniGameId(m.gameId) &&
    validArcadeSeat(m.roomId, m.tableId) &&
    Number.isSafeInteger(m.revision) &&
    m.revision >= 0 &&
    ['waiting', 'playing', 'finished'].includes(m.status) &&
    (!m.session || validArcadeSession(m.session)) &&
    [0, 1].includes(m.turn) &&
    (m.side === undefined || [0, 1].includes(m.side)) &&
    Number.isInteger(m.quiet) &&
    m.quiet >= 0 &&
    Array.isArray(m.moves) &&
    m.moves.length <= 300 &&
    m.moves.every(
      (a) =>
        a &&
        Number.isInteger(a.from) &&
        a.from >= 0 &&
        a.from < (m.gameId === 'chess' ? 64 : 90) &&
        Number.isInteger(a.to) &&
        a.to >= 0 &&
        a.to < (m.gameId === 'chess' ? 64 : 90) &&
        (a.promotion === undefined || ['q', 'r', 'b', 'n'].includes(a.promotion)),
    ) &&
    Array.isArray(m.history) &&
    m.history.length <= 301 &&
    m.history.every((s) => typeof s === 'string' && s.length < 400) &&
    Array.isArray(m.board) &&
    (m.status === 'waiting'
      ? m.board.length === 0
      : m.gameId === 'chess'
        ? m.board.length === 64 && m.board.every((p) => p === null || /^[wb][pnbrqk]$/.test(p as string))
        : m.gameId === 'chinese-chess'
          ? validXiangqiBoard(m.board)
          : m.board.length === 0) &&
    (m.roll === undefined ||
      (Array.isArray(m.roll) && m.roll.length === 3 && m.roll.every((n) => Number.isInteger(n) && n >= 0 && n < 6))) &&
    (m.choice === undefined || (Number.isInteger(m.choice) && m.choice >= 0 && m.choice < 6)) &&
    (m.multiplier === undefined || (Number.isInteger(m.multiplier) && m.multiplier >= 0 && m.multiplier <= 10)) &&
    (m.check === undefined || typeof m.check === 'boolean') &&
    (m.status !== 'finished' ||
      (['win', 'loss', 'draw'].includes(m.outcome ?? '') &&
        [
          'checkmate',
          'stalemate',
          'draw',
          'repetition',
          'perpetual-check',
          'turn-limit',
          'resign',
          'roll',
          'spin',
        ].includes(m.reason ?? '')))
  );
}

export function isMiniMatch(v: unknown): v is MiniMatch {
  const m = v as MiniMatch;
  try {
    if (!isMiniSnapshot(m) || !isRandomSeed(m.seed)) return false;
    if (m.gameId === 'chess' && m.status !== 'waiting') {
      const c = loadChess(m.moves);
      return JSON.stringify(chessBoard(c)) === JSON.stringify(m.board) && (c.turn() === 'w' ? 0 : 1) === m.turn;
    }
    if (m.gameId === 'chinese-chess' && m.status !== 'waiting') {
      let board = createXiangqiBoard(),
        turn: 0 | 1 = 0;
      const history = [key(board, turn)];
      for (const move of m.moves) {
        if (!isLegalXiangqiMove(board, turn === 0 ? 'r' : 'b', move)) return false;
        board = applyXiangqiMove(board, move);
        turn = turn === 0 ? 1 : 0;
        history.push(key(board, turn));
      }
      return (
        JSON.stringify(board) === JSON.stringify(m.board) &&
        turn === m.turn &&
        JSON.stringify(history) === JSON.stringify(m.history)
      );
    }
    return true;
  } catch {
    return false;
  }
}
