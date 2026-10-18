import type { GameSdk } from '@chibi-town/contracts';
import { ApiSdkError } from '@chibi-town/contracts';
import { type StealFarmCrop, validateStealFarmCrop } from '@chibi-town/contracts/farm-social';
import { isPlayerId } from '@chibi-town/contracts/social';
import { createCommandService } from '@chibi-town/game-service/application/command-service';
import { createFarmService as createFarmRules } from '@chibi-town/game-service/farm/farm-service';
import { farmVisit, stealFarmCrop } from '@chibi-town/game-service/farm/farm-social-service';
import type { FarmCommand } from '@chibi-town/game-service/service-types';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { withFriendFarms } from '@/modules/farm/repository';
import { type TransactionTrace, withPlayerDocument } from '@/modules/player';

export type MapSnapshotInput = Parameters<GameSdk['getMap']>[0];

export function createFarmService(deps: { db: Database; clock: () => number }) {
  const { db, clock } = deps;
  return {
    getFarmVisit(player: PlayerAccount, ownerId: string) {
      if (!isPlayerId(ownerId) || ownerId.toLowerCase() === player.id) throw new ApiSdkError('INVALID_COMMAND');
      const now = clock();
      return withFriendFarms(db, player.id, ownerId.toLowerCase(), now, (_visitor, _document, owner, document) =>
        farmVisit(owner, document, now),
      );
    },

    stealFarmCrop(player: PlayerAccount, input: StealFarmCrop) {
      validateStealFarmCrop(input);
      const now = clock();
      return withFriendFarms(db, player.id, input.ownerId, now, (visitor, visitorDocument, owner, ownerDocument) =>
        stealFarmCrop(visitor, visitorDocument, owner, ownerDocument, input, now),
      );
    },

    getFarmTheftHistory(player: PlayerAccount, trace?: TransactionTrace) {
      return withPlayerDocument(
        db,
        player.id,
        (document) => structuredClone(document.farmTheftHistory ?? []),
        trace,
        clock,
      );
    },

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
