import { ApiSdkError } from '@chibi-town/contracts';
import {
  LEGACY_RACE_ODDS,
  RACE_CYCLE,
  type RaceLobby,
  racePayout,
  racePhase,
  validateRaceBet,
} from '@chibi-town/contracts/pet-racing';
import { reservedArcadeCoins } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';
import { localPetRaceRound } from './pet-racing-round.js';

export function createPetRacingService(options: GameServiceOptions): Pick<GameService, 'getPetRace' | 'betPetRace'> {
  const roundAt = (time: number) => {
    const round = options.petRaceRounds?.find((entry) => time >= entry.bettingStartsAt && time < entry.nextRoundAt);
    if (!round && options.live) throw new ApiSdkError('STORAGE_UNAVAILABLE');
    return round ?? localPetRaceRound(time);
  };

  const lobby: ReturnType<GameService['getPetRace']> = (document) => {
    const now = options.clock();
    const record = roundAt(now);
    const state = document.petRacing;
    const bet = state?.bet;
    if (bet) {
      const prior =
        options.petRaceRounds?.find((entry) => entry.id === bet.roundId) ??
        (!options.live ? localPetRaceRound(Number(bet.roundId.slice(5)) * RACE_CYCLE) : undefined);
      if (!prior) throw new ApiSdkError('STORAGE_UNAVAILABLE');
      if (now >= prior.endsAt) {
        const payout = bet.pet === prior.winner ? racePayout(bet.stake, prior.odds[prior.winner]) : 0;
        if (!Number.isSafeInteger(document.farm.coins + payout)) throw new ApiSdkError('INVALID_COMMAND');
        document.farm.coins += payout;
        state!.lastRace = {
          ...bet,
          odds: prior.odds,
          startedAt: prior.startsAt,
          winner: prior.winner,
          finishTimes: prior.finishTimes,
          coinDelta: payout - bet.stake,
        };
        delete state!.bet;
        document.revision++;
      }
    }
    const phase = racePhase(record, now);
    const { winner, finishTimes, ...timing } = record;
    return {
      revision: document.revision,
      coins: document.farm.coins,
      availableCoins: Math.max(0, document.farm.coins - reservedArcadeCoins(document)),
      serverTime: now,
      round: { ...timing, phase, ...(phase === 'betting' ? {} : { winner, finishTimes }) },
      bet: state?.bet?.roundId === record.id ? state.bet : undefined,
      lastRace: state?.lastRace?.roundId
        ? { ...state.lastRace, odds: state.lastRace.odds ?? LEGACY_RACE_ODDS }
        : undefined,
    } satisfies RaceLobby;
  };

  return {
    getPetRace: () => lobby,

    betPetRace(input) {
      validateRaceBet(input);
      return (document) => {
        const current = lobby(document);
        const state = document.petRacing ?? { receipts: {} };
        const fingerprint = JSON.stringify([input.roundId, input.pet, input.stake]);
        const prior = Object.hasOwn(state.receipts, input.requestId) ? state.receipts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return current;
        }
        if (current.round.phase !== 'betting' || current.round.id !== input.roundId || state.bet)
          throw new ApiSdkError('MATCH_IN_PROGRESS');
        if (current.availableCoins < input.stake) throw new ApiSdkError('INSUFFICIENT_COINS');
        if (!Number.isSafeInteger(document.farm.coins + racePayout(input.stake, current.round.odds[input.pet])))
          throw new ApiSdkError('INVALID_COMMAND');
        document.farm.coins -= input.stake;
        document.revision++;
        state.bet = { ...input };
        Object.defineProperty(state.receipts, input.requestId, {
          value: { fingerprint, bet: { ...input } },
          enumerable: true,
          configurable: true,
          writable: true,
        });
        document.petRacing = state;
        return lobby(document);
      };
    },
  };
}
