import { ApiSdkError, type Command, validateCommand } from '@chibi-town/contracts';
import { advanceFarmAnimals } from '@chibi-town/gameplay';
import { equipOwnedOutfit } from '../character/equip-outfit.js';
import { executeFarmCommand } from '../farm/farm-commands.js';
import { executeCharacterInventory } from '../inventory/inventory-commands.js';
import { playerInstance as instance, playerSnapshot as snapshot } from '../player/player-state.js';
import { reservedArcadeCoins } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';

type InventoryCommand = Extract<
  Command,
  {
    type:
      | 'equip-outfit'
      | 'buy-cosmetic'
      | 'move-character-item'
      | 'equip-character-item'
      | 'unequip-character-item'
      | 'apply-cosmetic-color'
      | 'upgrade-character-item';
  }
>;

const inventoryCommands = {
  'equip-outfit': true,
  'buy-cosmetic': true,
  'move-character-item': true,
  'equip-character-item': true,
  'unequip-character-item': true,
  'apply-cosmetic-color': true,
  'upgrade-character-item': true,
  plot: false,
  batch: false,
  expand: false,
  feed: false,
  collect: false,
  'buy-animal': false,
  'buy-seeds': false,
  cook: false,
  'collect-dish': false,
  'sell-animal': false,
  'butcher-animal': false,
  sell: false,
  'upgrade-chest': false,
  'transfer-goods': false,
  'feed-all': false,
  'collect-all': false,
} satisfies Record<Command['type'], boolean>;

export function isInventoryCommand(command: Command): command is InventoryCommand {
  return inventoryCommands[command.type];
}

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
        if (isInventoryCommand(command)) {
          if (command.type === 'equip-outfit') equipOwnedOutfit(document, command.outfit, now);
          else executeCharacterInventory(document, command, command.requestId, now);
          state.coins = document.farm.coins;
          completed = 1;
        } else ({ completed, eligible } = executeFarmCommand(state, command, now));
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
