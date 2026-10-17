import { seededRandom } from '@chibi-town/character-core/random';
import {
  DEFAULT_RACE_CONFIG,
  RACE_CYCLE,
  RACE_PETS,
  type RaceConfig,
  type RaceRound,
  raceOdds,
  raceRoundTiming,
} from '@chibi-town/contracts/pet-racing';

/** Private immutable outcome. Only the public projection may cross the HTTP boundary. */
export type PetRaceRound = Omit<RaceRound, 'phase' | 'winner' | 'finishTimes'> & {
  winner: number;
  finishTimes: number[];
};

export function createPetRaceRound(
  now: number,
  random: () => number,
  config: RaceConfig = DEFAULT_RACE_CONFIG,
): PetRaceRound {
  const odds = raceOdds(config);
  const timing = raceRoundTiming(now);
  const draw = random() * 100;
  let cumulative = 0;
  const winner = odds.findIndex((pet) => {
    cumulative += pet.chance;
    return draw < cumulative;
  });
  if (winner < 0) throw new Error('Invalid pet race entropy');
  const winningTime = 18000 + random() * 1000;
  return {
    ...timing,
    odds,
    winner,
    finishTimes: RACE_PETS.map((_, lane) => (lane === winner ? winningTime : 19200 + random() * 700)),
  };
}

/** Local development simulates the same schedule; production persists cryptographic outcomes in Postgres. */
export function localPetRaceRound(now: number) {
  return createPetRaceRound(now, seededRandom(Math.floor(now / RACE_CYCLE) + 78431));
}
