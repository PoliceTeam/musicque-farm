import { createPlayerService as createPlayerRules } from '@chibi-town/game-service/player/player-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { readCharacterStats } from '@/modules/player/character-stats-repository';
import { type TransactionTrace, withPlayerDocument } from '@/modules/player/repository';

export function createPlayerService(deps: { db: Database; clock: () => number }) {
  return {
    async getPlayer(player: PlayerAccount, trace?: TransactionTrace) {
      const rules = createPlayerRules({ player, clock: deps.clock });
      const [profile, stats] = await Promise.all([
        withPlayerDocument(deps.db, player.id, rules.getPlayer(), trace, deps.clock),
        readCharacterStats(deps.db, player.id),
      ]);
      return { ...profile, stats };
    },
  };
}

export type PlayerService = ReturnType<typeof createPlayerService>;
