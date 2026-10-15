import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { GameService, GameServiceOptions } from '../service-types.js';

export function createPlayerService(options: GameServiceOptions): Pick<GameService, 'getPlayer'> {
  return {
    getPlayer() {
      return (document) => ({
        ...options.player,
        username: options.player.username ?? null,
        outfit: structuredClone(document.outfit ?? defaultOutfit),
      });
    },
  };
}
