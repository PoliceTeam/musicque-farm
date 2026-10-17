import { useArcadeHost } from '../host.js';

/** Artwork comes from the host; board coordinates and game rules remain independent. */
export function BoardPiece({
  game,
  piece,
  fallback,
}: {
  game: 'chess' | 'chinese-chess';
  piece: string;
  fallback: string;
}) {
  const { assets } = useArcadeHost();
  const src = assets[`${game === 'chess' ? 'chess' : 'xiangqi'}-piece-${piece}`];
  return src ? <img className="board-piece-art" src={src} alt="" draggable={false} /> : <span>{fallback}</span>;
}
