import type { Command } from '@chibi-town/contracts';
import {
  type CharacterInventoryQuery,
  validateCharacterInventoryQuery,
} from '@chibi-town/contracts/character-inventory';
import type { LuckyDrawCommand } from '@chibi-town/contracts/lucky-draw';
import { characterInventoryPage } from '@chibi-town/game-service';
import { createCommandService } from '@chibi-town/game-service/application/command-service';
import { createLuckyDrawService } from '@chibi-town/game-service/lucky-draw/lucky-draw-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { withCharacterInventory } from '@/modules/inventory/transaction';
import type { TransactionTrace } from '@/modules/player';

export function createInventoryService(deps: { db: Database; clock: () => number }) {
  const { db, clock } = deps;
  return {
    getLuckyDraw(player: PlayerAccount, trace?: TransactionTrace) {
      return withCharacterInventory(
        db,
        player.id,
        clock(),
        createLuckyDrawService({ player, clock }).getLuckyDraw(),
        trace,
      );
    },

    executeLuckyDraw(player: PlayerAccount, input: LuckyDrawCommand, trace?: TransactionTrace) {
      return withCharacterInventory(
        db,
        player.id,
        clock(),
        createLuckyDrawService({ player, clock }).executeLuckyDraw(input),
        trace,
      );
    },

    getInventory(player: PlayerAccount, query: CharacterInventoryQuery, trace?: TransactionTrace) {
      validateCharacterInventoryQuery(query);
      return withCharacterInventory(
        db,
        player.id,
        clock(),
        (document) => characterInventoryPage(document, query, clock()),
        trace,
      );
    },

    execute(player: PlayerAccount, command: Command, trace?: TransactionTrace) {
      // Shared command coordination retains receipt replay, reserved stakes and wallet checks.
      const operation = createCommandService({ player, clock }).execute(command);
      return withCharacterInventory(db, player.id, clock(), operation, trace);
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
