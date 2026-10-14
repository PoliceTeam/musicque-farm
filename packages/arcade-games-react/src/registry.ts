import type { GameSdk } from '@chibi-town/contracts';
import type { ComponentType } from 'react';
import type { ArcadeGameProps } from './_utils/arcade-game-props.js';
export type ArcadeGameModule = {
  id: string;
  title: string;
  seats: number;
  card: string;
  engine?: unknown;
  View: ComponentType<ArcadeGameProps>;
  messages: Record<string, unknown>;
  bindSdk: (sdk: GameSdk) => GameSdk;
  summary?: (sdk: GameSdk) => Promise<{ label: string; value: number }>;
  css?: string;
};

export function createArcadeGameRegistry() {
  const entries = new Map<string, ArcadeGameModule>();
  return {
    register(game: ArcadeGameModule) {
      if (entries.has(game.id)) throw new Error(`Game already registered: ${game.id}`);
      entries.set(game.id, Object.freeze({ ...game }));
    },

    get(id: string) {
      return entries.get(id);
    },

    list() {
      return [...entries.values()];
    },
  };
}
