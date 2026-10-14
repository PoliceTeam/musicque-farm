export type XiangqiBoard = (string | null)[];
export type BoardMove = { from: number; to: number; promotion?: 'q' | 'r' | 'b' | 'n' };

export function createXiangqiBoard(): XiangqiBoard {
  const b: XiangqiBoard = Array(90).fill(null),
    back = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  for (let x = 0; x < 9; x++) {
    b[x] = `b${back[x]}`;
    b[81 + x] = `r${back[x]}`;
  }
  for (const x of [1, 7]) {
    b[18 + x] = 'bc';
    b[63 + x] = 'rc';
  }
  for (const x of [0, 2, 4, 6, 8]) {
    b[27 + x] = 'bp';
    b[54 + x] = 'rp';
  }
  return b;
}

const inBoard = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 10;

const inPalace = (x: number, y: number, side: string) =>
  x >= 3 && x <= 5 && (side === 'r' ? y >= 7 && y <= 9 : y >= 0 && y <= 2);

function pseudo(board: XiangqiBoard, from: number, to: number) {
  const p = board[from];
  if (!p || from === to || board[to]?.[0] === p[0]) return false;
  const side = p[0],
    type = p[1],
    x = from % 9,
    y = Math.floor(from / 9),
    tx = to % 9,
    ty = Math.floor(to / 9),
    dx = tx - x,
    dy = ty - y,
    ax = Math.abs(dx),
    ay = Math.abs(dy);
  if (!inBoard(tx, ty)) return false;
  if (type === 'p')
    return (dy === (side === 'r' ? -1 : 1) && dx === 0) || ((side === 'r' ? y <= 4 : y >= 5) && dy === 0 && ax === 1);
  if (type === 'a') return ax === 1 && ay === 1 && inPalace(tx, ty, side);
  if (type === 'e')
    return ax === 2 && ay === 2 && (side === 'r' ? ty >= 5 : ty <= 4) && !board[(y + dy / 2) * 9 + x + dx / 2];
  if (type === 'h')
    return (
      (ax === 2 && ay === 1 && !board[y * 9 + x + Math.sign(dx)]) ||
      (ax === 1 && ay === 2 && !board[(y + Math.sign(dy)) * 9 + x])
    );
  if (type === 'k' && ax + ay === 1 && inPalace(tx, ty, side)) return true;
  if (dx && dy) return false;
  let blockers = 0;
  for (
    let xx = x + Math.sign(dx), yy = y + Math.sign(dy);
    xx !== tx || yy !== ty;
    xx += Math.sign(dx), yy += Math.sign(dy)
  )
    if (board[yy * 9 + xx]) blockers++;
  if (type === 'k') return dx === 0 && board[to]?.[1] === 'k' && blockers === 0;
  return type === 'r' ? blockers === 0 : type === 'c' ? (board[to] ? blockers === 1 : blockers === 0) : false;
}

export function xiangqiInCheck(board: XiangqiBoard, side: 'r' | 'b') {
  const king = board.indexOf(`${side}k`);
  if (king < 0) return true;
  return board.some((piece, index) => piece && piece[0] !== side && pseudo(board, index, king));
}

export function applyXiangqiMove(board: XiangqiBoard, move: BoardMove): XiangqiBoard {
  const next = [...board];
  next[move.to] = next[move.from];
  next[move.from] = null;
  return next;
}

export function isLegalXiangqiMove(board: XiangqiBoard, side: 'r' | 'b', move: BoardMove) {
  return (
    Number.isInteger(move.from) &&
    move.from >= 0 &&
    move.from < 90 &&
    Number.isInteger(move.to) &&
    move.to >= 0 &&
    move.to < 90 &&
    board[move.from]?.[0] === side &&
    pseudo(board, move.from, move.to) &&
    !xiangqiInCheck(applyXiangqiMove(board, move), side)
  );
}

export function legalXiangqiMoves(board: XiangqiBoard, side: 'r' | 'b'): BoardMove[] {
  const result: BoardMove[] = [];
  for (let from = 0; from < 90; from++)
    if (board[from]?.[0] === side)
      for (let to = 0; to < 90; to++)
        if (pseudo(board, from, to) && !xiangqiInCheck(applyXiangqiMove(board, { from, to }), side))
          result.push({ from, to });
  return result;
}

export function validXiangqiBoard(v: unknown): v is XiangqiBoard {
  return (
    Array.isArray(v) &&
    v.length === 90 &&
    v.every((p) => p === null || (typeof p === 'string' && /^[rb][rheakcp]$/.test(p))) &&
    v.filter((p) => p === 'rk').length <= 1 &&
    v.filter((p) => p === 'bk').length <= 1
  );
}

const VALUES: Record<string, number> = { k: 100000, r: 900, c: 450, h: 400, e: 200, a: 200, p: 100 };

function evaluation(board: XiangqiBoard, side: 'r' | 'b') {
  return board.reduce<number>(
    (sum, p, i) =>
      !p
        ? sum
        : sum +
          (p[0] === side ? 1 : -1) *
            (VALUES[p[1]] + (p[1] === 'p' ? (p[0] === 'r' ? 9 - Math.floor(i / 9) : Math.floor(i / 9)) * 10 : 0)),
    0,
  );
}

export function chooseXiangqiMove(
  board: XiangqiBoard,
  side: 'r' | 'b',
  difficulty: 'easy' | 'medium' | 'hard',
  random: number,
): BoardMove {
  const legal = legalXiangqiMoves(board, side);
  if (!legal.length) throw new Error('INVALID_PLAY');
  if (difficulty === 'easy') return legal[Math.floor(random * legal.length)];
  const opposite = side === 'r' ? 'b' : 'r';
  let best = legal[0],
    bestScore = -Infinity;
  // Medium chooses material/position, hard also searches every legal reply (two plies).
  for (const move of legal) {
    const next = applyXiangqiMove(board, move);
    let score = evaluation(next, side);
    const replies = legalXiangqiMoves(next, opposite);
    if (!replies.length) score = 1000000;
    else if (difficulty === 'hard')
      score = Math.min(...replies.map((reply) => evaluation(applyXiangqiMove(next, reply), side)));
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
