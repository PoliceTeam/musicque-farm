import {
  chessBoard,
  chessIndex,
  chessSquare,
  chooseChessMove,
  legalChessMoves,
  loadChess,
} from '@chibi-town/arcade-games/chess-logic';
import {
  createMiniMatch,
  isMiniMatch,
  isMiniSnapshot,
  legalMiniMoves,
  type MiniMatch,
  miniCoinDelta,
  miniSnapshot,
  playMiniAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import {
  applyXiangqiMove,
  chooseXiangqiMove,
  createXiangqiBoard,
  legalXiangqiMoves,
  type XiangqiBoard,
  xiangqiInCheck,
} from '@chibi-town/arcade-games/xiangqi-logic';
import { expect, it } from 'vitest';

const move = (from: string, to: string) => ({ from: chessIndex(from), to: chessIndex(to) });

function xFixture(): XiangqiBoard {
  const b: XiangqiBoard = Array(90).fill(null);
  b[4] = 'bk';
  b[85] = 'rk';
  b[49] = 'rp';
  return b;
}

function began(gameId: MiniMatch['gameId'], seed = 42) {
  return playMiniAction(createMiniMatch(gameId, 'fixture', 3, seed), { type: 'start' }).state;
}

it('chess opening has 20 legal moves and 400 legal replies; maps squares consistently', () => {
  const c = loadChess([]);
  expect(legalChessMoves(c)).toHaveLength(20);
  let replies = 0;
  for (const m of legalChessMoves(c)) {
    c.move({ from: chessSquare(m.from), to: chessSquare(m.to) });
    replies += legalChessMoves(c).length;
    c.undo();
  }
  expect(replies).toBe(400);
  for (let i = 0; i < 64; i++) expect(chessIndex(chessSquare(i))).toBe(i);
});
it('chess validates castling through check, en passant and all four promotion choices', () => {
  const castles = loadChess([], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  expect(legalChessMoves(castles)).toContainEqual(move('e1', 'g1'));
  expect(legalChessMoves(castles)).toContainEqual(move('e1', 'c1'));
  const attacked = loadChess([], 'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
  expect(legalChessMoves(attacked)).not.toContainEqual(move('e1', 'g1'));
  const ep = loadChess([move('e2', 'e4'), move('a7', 'a6'), move('e4', 'e5'), move('d7', 'd5')]);
  expect(legalChessMoves(ep)).toContainEqual(move('e5', 'd6'));
  ep.move({ from: 'e5', to: 'd6' });
  expect(ep.get('d5')).toBeUndefined();
  const promotion = loadChess([], '4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  expect(
    legalChessMoves(promotion)
      .filter((m) => m.from === chessIndex('a7') && m.to === chessIndex('a8'))
      .map((m) => m.promotion)
      .sort(),
  ).toEqual(['b', 'n', 'q', 'r']);
});
it('chess distinguishes mate, stalemate, repetition and insufficient material', () => {
  expect(loadChess([move('f2', 'f3'), move('e7', 'e5'), move('g2', 'g4'), move('d8', 'h4')]).isCheckmate()).toBe(true);
  expect(loadChess([], '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate()).toBe(true);
  expect(loadChess([], '7k/8/6K1/8/8/8/8/8 w - - 0 1').isInsufficientMaterial()).toBe(true);
  const repeat = [move('g1', 'f3'), move('g8', 'f6'), move('f3', 'g1'), move('f6', 'g8')];
  expect(loadChess([...repeat, ...repeat]).isThreefoldRepetition()).toBe(true);
});
it('chess bots preserve history and choose a legal move at each difficulty', () => {
  const c = loadChess([move('e2', 'e4'), move('e7', 'e5'), move('g1', 'f3')]);
  const before = c.fen();
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const choice = chooseChessMove(c, difficulty, 0.4);
    expect(legalChessMoves(c)).toContainEqual(choice);
    expect(c.fen()).toBe(before);
  }
  expect(chessBoard(c)).toHaveLength(64);
});
it('xiangqi starts with 32 pieces and 44 legal red moves', () => {
  const b = createXiangqiBoard();
  expect(b.filter(Boolean)).toHaveLength(32);
  expect(legalXiangqiMoves(b, 'r')).toHaveLength(44);
  expect(xiangqiInCheck(b, 'r')).toBe(false);
  expect(xiangqiInCheck(b, 'b')).toBe(false);
});
it('xiangqi horse legs, elephant eyes/river and cannon screens are enforced', () => {
  let b = xFixture();
  b[64] = 'rh';
  expect(legalXiangqiMoves(b, 'r')).toContainEqual({ from: 64, to: 45 });
  b[55] = 'rp';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 64, to: 45 });
  b = xFixture();
  b[83] = 're';
  expect(legalXiangqiMoves(b, 'r')).toContainEqual({ from: 83, to: 63 });
  b[73] = 'rp';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 83, to: 63 });
  b = xFixture();
  b[47] = 're';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 47, to: 31 });
  b = xFixture();
  b[63] = 'rc';
  b[9] = 'br';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 63, to: 9 });
  b[36] = 'bp';
  expect(legalXiangqiMoves(b, 'r')).toContainEqual({ from: 63, to: 9 });
  b[45] = 'rp';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 63, to: 9 });
});
it('xiangqi palaces, crossed-river pawns and flying generals prevent illegal exposure', () => {
  let b = xFixture();
  b[84] = 'ra';
  expect(
    legalXiangqiMoves(b, 'r')
      .filter((m) => m.from === 84)
      .every((m) => m.to % 9 >= 3 && m.to % 9 <= 5 && Math.floor(m.to / 9) >= 7),
  ).toBe(true);
  b = xFixture();
  b[54] = 'rp';
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 54, to: 55 });
  b[54] = null;
  b[36] = 'rp';
  expect(legalXiangqiMoves(b, 'r')).toContainEqual({ from: 36, to: 37 });
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 36, to: 45 });
  b = xFixture();
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 49, to: 48 });
  b[49] = null;
  expect(xiangqiInCheck(b, 'r')).toBe(true);
  expect(xiangqiInCheck(b, 'b')).toBe(true);
});
it('xiangqi stalemate is a loss even without being in check', () => {
  const b: XiangqiBoard = Array(90).fill(null);
  b[4] = 'bk';
  b[85] = 'rk';
  b[49] = 'rp';
  b[49] = 'bp';
  b[66] = 'br';
  b[68] = 'br';
  b[72] = 'br';
  expect(xiangqiInCheck(b, 'r')).toBe(false);
  expect(legalXiangqiMoves(b, 'r')).toEqual([]);
});
it('xiangqi bots choose legal moves without mutating the board', () => {
  const b = createXiangqiBoard(),
    before = JSON.stringify(b);
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    expect(legalXiangqiMoves(b, 'b')).toContainEqual(chooseXiangqiMove(b, 'b', difficulty, 0.5));
  expect(JSON.stringify(b)).toBe(before);
});
for (const gameId of ['bau-cua', 'slots'] as const)
  it(`${gameId} seeds replay identical outcomes and pay the documented amount`, () => {
    for (let seed = 1; seed <= 500; seed++) {
      const m = began(gameId, seed);
      m.session = { hostId: 'local-player', mode: 'wager', stake: 100, difficulty: 'medium' };
      const before = JSON.stringify(m),
        action = gameId === 'bau-cua' ? { type: 'roll' as const, symbol: seed % 6 } : { type: 'spin' as const };
      const next = playMiniAction(m, action);
      expect(playMiniAction(m, action)).toEqual(next);
      expect(JSON.stringify(m)).toBe(before);
      expect(isMiniMatch(next.state)).toBe(true);
      expect(next.state.status).toBe('finished');
      const roll = next.state.roll!;
      const expected =
        gameId === 'bau-cua'
          ? (roll.filter((v) => v === seed % 6).length || -1) * 100
          : (roll.every((v) => v === roll[0]) ? (roll[0] === 5 ? 10 : 5) : new Set(roll).size === 2 ? 2 : 0) * 100 -
            100;
      expect(miniCoinDelta(next.state)).toBe(expected);
    }
  });
it('casino practice never changes coins and invalid commands cannot change state', () => {
  const m = began('bau-cua');
  m.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty: 'medium' };
  expect(miniCoinDelta(playMiniAction(m, { type: 'roll', symbol: 0 }).state)).toBe(0);
  expect(() => playMiniAction(m, { type: 'roll', symbol: 6 })).toThrow('INVALID_PLAY');
  expect(() => playMiniAction(m, { type: 'spin' })).toThrow('INVALID_PLAY');
  expect(() => playMiniAction(m, { type: 'move', from: 0, to: 1 })).toThrow('INVALID_PLAY');
});
for (const gameId of ['chess', 'chinese-chess'] as const)
  it(`${gameId} processes player and bot turns with valid immutable snapshots`, () => {
    let m = began(gameId);
    m.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty: 'easy' };
    for (let i = 0; i < 35 && m.status === 'playing'; i++) {
      const before = JSON.stringify(m),
        move = legalMiniMoves(m)[(i * 7) % legalMiniMoves(m).length];
      const next = playMiniAction(m, { type: 'move', ...move });
      expect(JSON.stringify(m)).toBe(before);
      expect(isMiniMatch(next.state)).toBe(true);
      expect(isMiniSnapshot(next.result.match)).toBe(true);
      expect(next.result.match).not.toHaveProperty('seed');
      expect(next.result.steps.length).toBeLessThanOrEqual(2);
      expect(next.state.status === 'finished' || next.state.turn === 0).toBe(true);
      m = next.state;
    }
  });
it('rejects corrupt board snapshots and chess history', () => {
  const m = began('chess');
  expect(isMiniMatch({ ...m, board: Array(64).fill('zz') })).toBe(false);
  expect(isMiniMatch({ ...m, moves: [{ from: 0, to: 63 }] })).toBe(false);
  expect(isMiniSnapshot({ ...miniSnapshot(m), turn: 8 })).toBe(false);
  expect(() => playMiniAction(m, { type: 'move', from: 0, to: 10 })).toThrow('INVALID_PLAY');
});
it('xiangqi moving a blocker never exposes its own general', () => {
  const b = xFixture(),
    next = applyXiangqiMove(b, { from: 49, to: 48 });
  expect(xiangqiInCheck(next, 'r')).toBe(true);
  expect(legalXiangqiMoves(b, 'r')).not.toContainEqual({ from: 49, to: 48 });
});
