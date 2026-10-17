import { ApiSdkError } from './index.js';

/** IDs and lane order are stable; live odds come from each server round. */
export const RACE_PETS = [
  { id: 'corgi' },
  { id: 'cat' },
  { id: 'bunny' },
  { id: 'fox' },
  { id: 'chick' },
  { id: 'dragon' },
] as const;
export type RaceConfig = { chances: number[]; returnRateBps: number };
export type RaceOdds = { chance: number; payoutNumerator: number; payoutDenominator: number };
/** Seed for an empty database and the local development adapter only. */
export const DEFAULT_RACE_CONFIG: RaceConfig = { chances: [24, 22, 18, 15, 12, 9], returnRateBps: 9000 };
/** Preserve terms promised by rounds/results saved before DB-backed configuration. */
export const LEGACY_RACE_ODDS: RaceOdds[] = [4, 4, 5, 6, 8, 10].map((multiplier, index) => ({
  chance: [24, 22, 18, 15, 12, 9][index],
  payoutNumerator: multiplier,
  payoutDenominator: 1,
}));

export function raceOdds(config: RaceConfig): RaceOdds[] {
  if (
    !config ||
    !Array.isArray(config.chances) ||
    config.chances.length !== RACE_PETS.length ||
    !config.chances.every((chance) => Number.isInteger(chance) && chance > 0 && chance < 100) ||
    config.chances.reduce((sum, chance) => sum + chance, 0) !== 100 ||
    !Number.isInteger(config.returnRateBps) ||
    config.returnRateBps > 10000 ||
    config.returnRateBps <= Math.max(...config.chances) * 100
  )
    throw new ApiSdkError('INVALID_COMMAND');
  return config.chances.map((chance) => ({
    chance,
    payoutNumerator: config.returnRateBps,
    payoutDenominator: chance * 100,
  }));
}

/** Integer division keeps wallet credits and UI previews identical; fractions of a coin round down. */
export function racePayout(stake: number, odds: RaceOdds) {
  return Math.floor((stake * odds.payoutNumerator) / odds.payoutDenominator);
}

function validOdds(value: unknown): value is RaceOdds[] {
  return (
    Array.isArray(value) &&
    value.length === RACE_PETS.length &&
    value.every(
      (odd: RaceOdds) =>
        odd &&
        Number.isInteger(odd.chance) &&
        odd.chance > 0 &&
        odd.chance < 100 &&
        Number.isInteger(odd.payoutNumerator) &&
        odd.payoutNumerator <= 10000 &&
        Number.isInteger(odd.payoutDenominator) &&
        odd.payoutDenominator > 0 &&
        odd.payoutDenominator <= 10000 &&
        odd.payoutNumerator > odd.payoutDenominator,
    ) &&
    value.reduce((sum, odd) => sum + odd.chance, 0) === 100
  );
}

export const RACE_COUNTDOWN = 5000;
export const RACE_RUN_DURATION = 20000;
export const RACE_DURATION = RACE_COUNTDOWN + RACE_RUN_DURATION;
export const RACE_BETTING_DURATION = 30000;
export const RACE_RESULT_DURATION = 7000;
export const RACE_CYCLE = RACE_BETTING_DURATION + RACE_DURATION + RACE_RESULT_DURATION;
export const RACE_MIN_STAKE = 10;
export const RACE_MAX_STAKE = 100000;
export type RacePhase = 'betting' | 'countdown' | 'racing' | 'results';
export type RaceBet = { requestId: string; roundId: string; pet: number; stake: number };
export type RaceResult = RaceBet & {
  odds: RaceOdds[];
  startedAt: number;
  winner: number;
  finishTimes: number[];
  coinDelta: number;
};
export type RaceRound = {
  odds: RaceOdds[];
  id: string;
  bettingStartsAt: number;
  startsAt: number;
  endsAt: number;
  nextRoundAt: number;
  phase: RacePhase;
  winner?: number;
  finishTimes?: number[];
};
export type RaceLobby = {
  revision: number;
  coins: number;
  availableCoins: number;
  serverTime: number;
  round: RaceRound;
  bet?: RaceBet;
  lastRace?: RaceResult;
};

export function raceRoundTiming(now: number) {
  const index = Math.floor(now / RACE_CYCLE);
  const bettingStartsAt = index * RACE_CYCLE;
  const startsAt = bettingStartsAt + RACE_BETTING_DURATION;
  return {
    id: `race-${index}`,
    bettingStartsAt,
    startsAt,
    endsAt: startsAt + RACE_DURATION,
    nextRoundAt: bettingStartsAt + RACE_CYCLE,
  };
}

export function racePhase(round: Pick<RaceRound, 'startsAt' | 'endsAt'>, now: number): RacePhase {
  return now < round.startsAt
    ? 'betting'
    : now < round.startsAt + RACE_COUNTDOWN
      ? 'countdown'
      : now < round.endsAt
        ? 'racing'
        : 'results';
}

export function validateRaceBet(value: RaceBet) {
  if (
    !value ||
    typeof value.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.requestId) ||
    typeof value.roundId !== 'string' ||
    !/^race-\d{1,12}$/.test(value.roundId) ||
    !Number.isInteger(value.pet) ||
    value.pet < 0 ||
    value.pet >= RACE_PETS.length ||
    !Number.isSafeInteger(value.stake) ||
    value.stake < RACE_MIN_STAKE ||
    value.stake > RACE_MAX_STAKE
  )
    throw new ApiSdkError('INVALID_COMMAND');
}

function validOutcome(value: { winner?: number; finishTimes?: number[] }) {
  const { winner, finishTimes } = value;
  return (
    Number.isInteger(winner) &&
    winner! >= 0 &&
    winner! < RACE_PETS.length &&
    Array.isArray(finishTimes) &&
    finishTimes.length === RACE_PETS.length &&
    finishTimes.every((time) => Number.isFinite(time) && time >= 9000 && time <= RACE_DURATION - RACE_COUNTDOWN) &&
    finishTimes.every((time, lane) => lane === winner || time > finishTimes[winner!])
  );
}

export function decodeRaceLobby(value: unknown): RaceLobby {
  const data = value as RaceLobby;
  const round = data?.round;
  if (
    !data ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    !Number.isSafeInteger(data.coins) ||
    data.coins < 0 ||
    !Number.isSafeInteger(data.availableCoins) ||
    data.availableCoins < 0 ||
    data.availableCoins > data.coins ||
    !Number.isFinite(data.serverTime) ||
    !round ||
    !validOdds(round.odds) ||
    !Number.isSafeInteger(round.bettingStartsAt) ||
    round.bettingStartsAt < 0 ||
    JSON.stringify(raceRoundTiming(round.bettingStartsAt)) !==
      JSON.stringify({
        id: round.id,
        bettingStartsAt: round.bettingStartsAt,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        nextRoundAt: round.nextRoundAt,
      }) ||
    data.serverTime < round.bettingStartsAt ||
    data.serverTime >= round.nextRoundAt ||
    round.phase !== racePhase(round, data.serverTime) ||
    (round.phase === 'betting' ? round.winner !== undefined || round.finishTimes !== undefined : !validOutcome(round))
  )
    throw new ApiSdkError('NETWORK_ERROR');
  if (data.bet) {
    validateRaceBet(data.bet);
    if (data.bet.roundId !== round.id) throw new ApiSdkError('NETWORK_ERROR');
  }
  if (data.lastRace) {
    const race = data.lastRace;
    validateRaceBet(race);
    if (
      !Number.isSafeInteger(race.startedAt) ||
      !validOutcome(race) ||
      !validOdds(race.odds) ||
      !Number.isSafeInteger(race.coinDelta) ||
      race.coinDelta !==
        (race.pet === race.winner ? racePayout(race.stake, race.odds[race.winner]) - race.stake : -race.stake) ||
      race.startedAt + RACE_DURATION > data.serverTime
    )
      throw new ApiSdkError('NETWORK_ERROR');
  }
  return data;
}
