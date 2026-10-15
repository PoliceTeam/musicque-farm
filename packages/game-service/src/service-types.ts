import type { RandomSeed } from '@chibi-town/arcade-games/random';
import type { Command, GameSdk } from '@chibi-town/contracts';
import type { PlayerDocument } from './player-document.js';

type World = Awaited<ReturnType<GameSdk['getWorld']>>;
export type GameServiceOptions = {
  /** The authenticated player; table sessions record this id as host and member. */
  player: { id: string; name: string; username?: string | null; level: number };
  clock: () => number;
  /** Unit-interval random source; defaults to cryptographic entropy. */
  random?: () => number;
  randomSeed?: () => RandomSeed;
  /** Other players in a channel, excluding `player`. */
  channelPopulation?: (mapId: string, channelId: number, capacity: number) => number;
  /** True when lobbies and channels describe real players rather than a single local save. */
  live?: boolean;
  world?: World;
};
/**
 * Every SDK call as a two-step function: the outer call validates the input, the returned operation reads and
 * mutates one player document. The caller owns storage and runs the operation inside its own transaction.
 */
export type GameService = {
  [K in keyof GameSdk]: (
    ...args: Parameters<GameSdk[K]>
  ) => (document: PlayerDocument) => Awaited<ReturnType<GameSdk[K]>>;
};

export type FarmCommand = Exclude<
  Command,
  {
    type:
      | 'equip-outfit'
      | 'buy-cosmetic'
      | 'move-character-item'
      | 'equip-character-item'
      | 'unequip-character-item'
      | 'apply-cosmetic-color';
  }
>;
