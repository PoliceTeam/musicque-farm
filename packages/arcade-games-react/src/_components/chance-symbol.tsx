import type { MiniGameId } from '@chibi-town/arcade-games/mini-games-logic';

const ANIMALS = ['bottle-gourd', '🦀', '🦐', '🐟', '🐓', '🦌'];
const REELS = ['🍒', '🍋', '🔔', '⭐', '🍀', '💎'];

export function chanceSymbol(gameId: MiniGameId, index: number) {
  if (gameId === 'bau-cua' && index === 0)
    return (
      <svg viewBox="0 0 64 80" aria-hidden="true" className="mini-gourd">
        <path d="M34 14 Q31 7 40 3" fill="none" stroke="#526923" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M21 15 C8 27 21 37 18 42 C-2 64 13 78 32 78 C52 78 66 63 46 42 C43 37 55 26 43 15 C38 10 26 10 21 15Z"
          fill="#8eb340"
          stroke="#547626"
          strokeWidth="3"
        />
        <path
          d="M24 19 Q15 28 26 35 M18 53 Q10 66 25 70"
          fill="none"
          stroke="#d9e7a1"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    );
  return (gameId === 'bau-cua' ? ANIMALS : REELS)[index];
}
