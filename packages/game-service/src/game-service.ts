import { validateCharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import { createCommandService } from './application/command-service.js';
import { createDiamondService } from './arcade/diamond-service.js';
import { createMemberService } from './arcade/member-service.js';
import { createMiniService } from './arcade/mini-service.js';
import { createPetRacingService } from './arcade/pet-racing-service.js';
import { createPhomService } from './arcade/phom-service.js';
import { createPracticeContext } from './arcade/practice-context.js';
import { createSettingsService } from './arcade/settings-service.js';
import { createTienService } from './arcade/tien-service.js';
import { characterInventoryPage } from './character-inventory.js';
import { createFarmService } from './farm/farm-service.js';
import { createJewelerService } from './jeweler/jeweler-service.js';
import { createLuckyDrawService } from './lucky-draw/lucky-draw-service.js';
import { createPlayerService } from './player/player-service.js';
import type { GameService, GameServiceOptions } from './service-types.js';
import { createWorldService } from './world/world-service.js';

export type { GameService, GameServiceOptions } from './service-types.js';

/** SDK composition only. Feature modules own their validation and operations. */
export function createGameService(options: GameServiceOptions): GameService {
  const practice = createPracticeContext(options);
  return {
    ...createPlayerService(options),
    ...createJewelerService(),
    ...createLuckyDrawService(options),
    ...createPetRacingService(options),
    ...createWorldService(options),
    ...createFarmService(options),
    ...createMiniService(practice),
    ...createTienService(practice),
    ...createPhomService(practice),
    ...createDiamondService(practice),
    ...createMemberService(practice),
    ...createSettingsService(practice),
    ...createCommandService(options),

    getCharacterInventory(query) {
      validateCharacterInventoryQuery(query);
      return (document) => characterInventoryPage(document, query, options.clock());
    },
  };
}
