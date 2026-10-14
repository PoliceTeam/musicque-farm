import type { GameSdk } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
export type ArcadeGameProps = {
  player: Awaited<ReturnType<GameSdk['getPlayer']>>;
  coins: number;
  audio: ReturnType<typeof createGameAudio>;
  back: () => void;
  refreshWallet: () => Promise<void>;
};
