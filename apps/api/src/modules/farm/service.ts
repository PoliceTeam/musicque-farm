import type { GameSdk } from '@chibi-town/contracts';
import { createCommandService } from '@chibi-town/game-service/application/command-service';
import { createFarmService as createFarmRules } from '@chibi-town/game-service/farm/farm-service';
import type { FarmCommand } from '@chibi-town/game-service/service-types';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { type TransactionTrace, withPlayerDocument } from '@/modules/player';

export type MapSnapshotInput = Parameters<GameSdk['getMap']>[0];

export function createFarmService(deps: { db: Database; clock: () => number }) {
  const { db, clock } = deps;
  return {
    getInventory(player: PlayerAccount, trace?: TransactionTrace) {
      const rules = createFarmRules({ player, clock });
      return withPlayerDocument(db, player.id, rules.getInventory(), trace, clock);
    },

    getMap(player: PlayerAccount, input: MapSnapshotInput, trace?: TransactionTrace) {
      const rules = createFarmRules({ player, clock });
      return withPlayerDocument(db, player.id, rules.getMap(input), trace, clock);
    },

    execute(player: PlayerAccount, command: FarmCommand, trace?: TransactionTrace) {
      const operation = createCommandService({ player, clock }).execute(command);
      return withPlayerDocument(db, player.id, operation, trace, clock);
    },
  };
}

export type FarmService = ReturnType<typeof createFarmService>;
