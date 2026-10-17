import { ApiSdkError } from '@chibi-town/contracts';
import type { RaceBet } from '@chibi-town/contracts/pet-racing';
import { createGameService } from '@chibi-town/game-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import { DEFAULT_PET_RACE_RESET, type PetRaceResetConfig } from '@/config';
import type { Database } from '@/infrastructure/database/database';
import {
  ensureRaceRound,
  findRaceRound,
  maintainRaceConfig,
  markRaceSettled,
  pendingRacePlayers,
  queueRaceBet,
  takeRacePhaseChange,
} from '@/modules/arcade/pet-racing/repository';
import { type TransactionTrace, withPlayerTransaction } from '@/modules/player';

export function createSharedPetRacingService(
  db: Database,
  clock: () => number,
  resetPolicy: PetRaceResetConfig = DEFAULT_PET_RACE_RESET,
) {
  const run = (player: Pick<PlayerAccount, 'id' | 'name' | 'level'>, input?: RaceBet, trace?: TransactionTrace) =>
    withPlayerTransaction(
      db,
      player.id,
      async (document, tx) => {
        const now = clock();
        const round = await ensureRaceRound(tx, now, resetPolicy);
        const pending = document.petRacing?.bet;
        const prior = pending && pending.roundId !== round.id ? await findRaceRound(tx, pending.roundId) : undefined;
        if (pending && pending.roundId !== round.id && !prior) throw new ApiSdkError('STORAGE_UNAVAILABLE');
        const rules = createGameService({
          player,

          clock: () => now,

          live: true,
          petRaceRounds: prior ? [round, prior] : [round],
        });
        const result = input ? rules.betPetRace(input)(document) : rules.getPetRace()(document);
        if (pending && document.petRacing?.bet?.roundId !== pending.roundId)
          await markRaceSettled(tx, player.id, pending.roundId);
        if (input && document.petRacing?.bet?.roundId === round.id)
          await queueRaceBet(tx, player.id, round.id, round.endsAt);
        return result;
      },
      trace,
      clock,
    );

  return {
    phaseChange: () => takeRacePhaseChange(db, clock(), resetPolicy),

    initialize: () => maintainRaceConfig(db, clock(), resetPolicy),

    get: (player: PlayerAccount, trace?: TransactionTrace) => run(player, undefined, trace),

    bet: (player: PlayerAccount, input: RaceBet, trace?: TransactionTrace) => run(player, input, trace),

    async sweep() {
      await maintainRaceConfig(db, clock(), resetPolicy);
      const pending = await pendingRacePlayers(db, clock());
      const errors: unknown[] = [];
      for (const { playerId } of pending) {
        try {
          await run({ id: playerId, name: '', level: 1 });
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Pet race settlements failed');
    },
  };
}
