import { ApiSdkError, validateCommand } from '@chibi-town/contracts';
import { advanceFarmAnimals } from '@chibi-town/gameplay';
import { equipOwnedOutfit, executeCharacterInventory } from '../character-inventory.js';
import { executeFarmCommand } from '../farm/farm-commands.js';
import { playerInstance as instance, playerSnapshot as snapshot } from '../player/player-state.js';
import { reservedArcadeCoins } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';

export function createCommandService(options: GameServiceOptions): Pick<GameService, 'execute'> {
  const clock = options.clock;
  const reservedCoins = reservedArcadeCoins;
  return {
    execute(command) {
      validateCommand(command);
      return (document) => {
        const state = instance(document, command.mapInstanceId);
        const fingerprint = JSON.stringify(command);
        const prior = Object.hasOwn(document.requests, command.requestId)
          ? document.requests[command.requestId]
          : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return { ...snapshot(document, clock(), state, command.mapInstanceId), ...prior.result };
        }
        const now = clock();

        advanceFarmAnimals(state, now);
        let completed = 0,
          eligible = 1;
        switch (command.type) {
          case 'equip-outfit':
            equipOwnedOutfit(document, command.outfit, now);
            completed = 1;
            break;
          case 'buy-cosmetic':
          case 'move-character-item':
          case 'equip-character-item':
          case 'unequip-character-item':
          case 'apply-cosmetic-color':
            executeCharacterInventory(document, command, command.requestId, now);
            state.coins = document.farm.coins;
            completed = 1;
            break;
          default:
            ({ completed, eligible } = executeFarmCommand(state, command, now));
        }
        if (!completed) throw new ApiSdkError('NOT_ALLOWED');
        if (state.coins < reservedCoins(document)) throw new ApiSdkError('INSUFFICIENT_COINS');
        document.farm.coins = state.coins;
        document.farm.gems = state.gems;
        document.farm.seeds = state.seeds;
        document.farm.inventory = state.inventory;
        document.farm.chests = state.chests;
        document.farm.homeInventory = state.homeInventory;
        document.revision++;
        const result = { ...snapshot(document, now, state, command.mapInstanceId), completed, eligible };
        Object.defineProperty(document.requests, command.requestId, {
          value: { fingerprint, result: { completed, eligible } },
          enumerable: true,
          configurable: true,
          writable: true,
        });
        return result;
      };
    },
  };
}
