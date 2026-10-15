import { createPlayerService as createPlayerRules } from '@chibi-town/game-service/player/player-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { type TransactionTrace, withPlayerDocument } from '@/modules/player/repository';

export function createPlayerService(deps: { db: Database; clock: () => number }) {
  return {
    getPlayer(player: PlayerAccount, trace?: TransactionTrace) {
      const rules = createPlayerRules({ player, clock: deps.clock });
      return withPlayerDocument(deps.db, player.id, rules.getPlayer(), trace);
    },
  };
}

export type PlayerService = ReturnType<typeof createPlayerService>;
