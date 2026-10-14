import { Chess, type Square } from 'chess.js';
import type { BoardMove } from './xiangqi-logic.js';

export const chessSquare = (index: number) => `${'abcdefgh'[index % 8]}${8 - Math.floor(index / 8)}` as Square;

export const chessIndex = (square: string) => 'abcdefgh'.indexOf(square[0]) + (8 - Number(square[1])) * 8;

export function loadChess(moves: BoardMove[], initial?: string) {
  const chess = new Chess(initial);
  for (const m of moves)
    chess.move({ from: chessSquare(m.from), to: chessSquare(m.to), promotion: m.promotion ?? 'q' });
  return chess;
}

export function chessBoard(chess: Chess) {
  return chess
    .board()
    .flat()
    .map((p) => (p ? `${p.color}${p.type}` : null));
}

export function legalChessMoves(chess: Chess): BoardMove[] {
  return chess.moves({ verbose: true }).map((m) => ({
    from: chessIndex(m.from),
    to: chessIndex(m.to),
    ...(m.promotion ? { promotion: m.promotion as BoardMove['promotion'] } : {}),
  }));
}

const VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluate(chess: Chess, side: string) {
  return chess
    .board()
    .flat()
    .reduce(
      (sum, p) =>
        !p
          ? sum
          : sum +
            (p.color === side ? 1 : -1) *
              (VALUES[p.type] +
                (p.type === 'p'
                  ? (p.color === 'w' ? Number(p.square[1]) : 9 - Number(p.square[1])) * 3
                  : Math.max(
                      0,
                      4 - Math.abs('abcdefgh'.indexOf(p.square[0]) - 3.5) - Math.abs(Number(p.square[1]) - 4.5),
                    ) * 3)),
      0,
    );
}

export function chooseChessMove(chess: Chess, difficulty: 'easy' | 'medium' | 'hard', random: number): BoardMove {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) throw new Error('INVALID_PLAY');
  if (difficulty === 'easy') {
    const m = moves[Math.floor(random * moves.length)];
    return { from: chessIndex(m.from), to: chessIndex(m.to), promotion: m.promotion as BoardMove['promotion'] };
  }
  const side = chess.turn();
  let nodes = 0;

  function search(depth: number, alpha: number, beta: number): number {
    nodes++;
    if (chess.isCheckmate()) return chess.turn() === side ? -100000 - depth : 100000 + depth;
    if (chess.isDraw()) return 0;
    if (depth === 0 || nodes > 12000) return evaluate(chess, side);
    const maximizing = chess.turn() === side;
    let best = maximizing ? -Infinity : Infinity;
    const options = chess
      .moves({ verbose: true })
      .sort((a, b) => (VALUES[b.captured ?? ''] ?? 0) - (VALUES[a.captured ?? ''] ?? 0));
    for (const m of options) {
      chess.move(m);
      const score = search(depth - 1, alpha, beta);
      chess.undo();
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
      if (maximizing) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = moves[0],
    value = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const score = search(difficulty === 'hard' ? 2 : 0, -Infinity, Infinity);
    chess.undo();
    if (score > value) {
      value = score;
      best = m;
    }
  }
  return { from: chessIndex(best.from), to: chessIndex(best.to), promotion: best.promotion as BoardMove['promotion'] };
}
