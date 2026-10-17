import { pets } from '@chibi-town/character-core/item-catalog';
import { seededRandom } from '@chibi-town/character-core/random';
import {
  DEFAULT_RACE_CONFIG,
  decodeRaceLobby,
  RACE_COUNTDOWN,
  RACE_CYCLE,
  RACE_DURATION,
  RACE_PETS,
  type RaceResult,
  raceOdds,
  racePayout,
  racePhase,
  raceRoundTiming,
} from '@chibi-town/contracts/pet-racing';
import { expect, it } from 'vitest';
import { createRaceAudience } from '@/features/pet-racing/_utils/race-audience';
import { nextRaceRefreshDelay, raceMultiplierLabel, raceProgress } from '@/features/pet-racing/_utils/race-logic';

it('keeps animated lanes bounded, moving forward, and faithful to the server finish times', () => {
  const race: RaceResult = {
    odds: raceOdds(DEFAULT_RACE_CONFIG),
    requestId: 'race',
    roundId: 'race-0',
    pet: 2,
    stake: 10,
    winner: 2,
    startedAt: 0,
    coinDelta: 40,
    finishTimes: [12000, 13000, 10500, 14000, 11500, 14500],
  };
  for (let lane = 0; lane < 6; lane++) {
    expect(raceProgress(race, lane, -3000)).toBe(0);
    let previous = 0;
    for (let time = 0; time < race.finishTimes[lane]; time += 10) {
      const progress = raceProgress(race, lane, time);
      expect(progress).toBeGreaterThanOrEqual(previous);
      expect(progress).toBeLessThan(1);
      previous = progress;
    }
    expect(raceProgress(race, lane, race.finishTimes[lane])).toBe(1);
  }
  expect(raceProgress(race, 2, 10500)).toBe(1);
  expect(raceProgress(race, 0, 10500)).toBeLessThan(1);
});

it('rejects inconsistent payouts and finish times that outlast the race presentation', () => {
  const race: RaceResult = {
    odds: raceOdds(DEFAULT_RACE_CONFIG),
    requestId: 'verified',
    roundId: 'race-0',
    pet: 0,
    stake: 100,
    winner: 0,
    startedAt: 30000,
    coinDelta: 275,
    finishTimes: [10500, 12000, 13000, 14000, 14500, 12500],
  };
  const lobby = {
    revision: 2,
    coins: 1275,
    availableCoins: 1275,
    serverTime: 55000,
    lastRace: race,
    round: {
      odds: race.odds,
      ...raceRoundTiming(0),
      phase: 'results' as const,
      winner: race.winner,
      finishTimes: race.finishTimes,
    },
  };
  expect(decodeRaceLobby(lobby)).toEqual(lobby);
  expect(() => decodeRaceLobby({ ...lobby, round: { ...lobby.round, odds: undefined } })).toThrow('NETWORK_ERROR');
  expect(() => decodeRaceLobby({ ...lobby, lastRace: { ...race, odds: [] } })).toThrow('NETWORK_ERROR');
  expect(() => decodeRaceLobby({ ...lobby, lastRace: { ...race, coinDelta: 400 } })).toThrow('NETWORK_ERROR');
  expect(() =>
    decodeRaceLobby({
      ...lobby,
      lastRace: { ...race, finishTimes: [10500, RACE_DURATION - RACE_COUNTDOWN + 1, 13000, 14000, 14500, 12500] },
    }),
  ).toThrow('NETWORK_ERROR');
  expect(() =>
    decodeRaceLobby({ ...lobby, lastRace: { ...race, finishTimes: [10500, 10000, 13000, 14000, 14500, 12500] } }),
  ).toThrow('NETWORK_ERROR');
  expect(() => decodeRaceLobby({ ...lobby, availableCoins: 1276 })).toThrow('NETWORK_ERROR');
});

it('uses six existing pet families and a complete probability distribution', () => {
  expect(new Set(RACE_PETS.map((pet) => pet.id)).size).toBe(6);
  expect(DEFAULT_RACE_CONFIG.chances.reduce((sum, chance) => sum + chance, 0)).toBe(100);
  for (const entry of RACE_PETS) expect(pets[entry.id]).toBeDefined();
});

it('uses one shared schedule with closed bets during countdown/racing and automatic next rounds', () => {
  const round = raceRoundTiming(0);
  expect(racePhase(round, 29999)).toBe('betting');
  expect(racePhase(round, 30000)).toBe('countdown');
  expect(racePhase(round, 35000)).toBe('racing');
  expect(racePhase(round, 55000)).toBe('results');
  expect(raceRoundTiming(RACE_CYCLE).id).not.toBe(round.id);
  expect(racePhase(raceRoundTiming(RACE_CYCLE), RACE_CYCLE)).toBe('betting');
});

it('chooses varied clothed spectators from the real catalog and keeps obstructing equipment off seats', () => {
  const audience = createRaceAudience(seededRandom(839));
  expect(audience).toHaveLength(7);
  expect(new Set(audience.map(({ outfit }) => JSON.stringify(outfit))).size).toBe(7);
  expect(new Set(audience.map(({ outfit }) => outfit.shirt)).size).toBeGreaterThan(1);
  expect(new Set(audience.map(({ outfit }) => outfit.hair)).size).toBeGreaterThan(1);
  for (const { outfit } of audience) {
    expect(outfit.shirt).toBeTruthy();
    expect(outfit.shoes).toBeTruthy();
    expect(outfit.pet).toBe('');
    expect(outfit.back).toBe('');
  }
});

it('shows each pet at the finish after its server time when motion is reduced', () => {
  const race = { finishTimes: [18000, 19200, 19300, 19400, 19500, 19600] };
  expect(raceProgress(race, 0, 17999, true)).toBe(0);
  expect(raceProgress(race, 0, 18000, true)).toBe(1);
  expect(raceProgress(race, 1, 18000, true)).toBe(0);
  for (let lane = 0; lane < 6; lane++) expect(raceProgress(race, lane, 20000, true)).toBe(1);
});

it('calculates odds from one return rate and floors payouts identically to the server', () => {
  const odds = raceOdds(DEFAULT_RACE_CONFIG);
  for (const odd of odds) expect(((odd.chance / 100) * odd.payoutNumerator) / odd.payoutDenominator).toBeCloseTo(0.9);
  expect(raceMultiplierLabel(odds[0])).toBe('×3,75');
  expect(raceMultiplierLabel(odds[1])).toBe('≈×4,09');
  expect(racePayout(100, odds[0])).toBe(375);
  expect(racePayout(100, odds[1])).toBe(409);
  expect(racePayout(100000, odds[1])).toBe(409090);
  expect(() => raceOdds({ chances: [24, 22, 18, 15, 12, 8], returnRateBps: 9000 })).toThrow();
  expect(() => raceOdds({ chances: [24, 22, 18, 15, 12, 9], returnRateBps: 10001 })).toThrow();
});

it('refreshes at phase boundaries rather than polling every second', () => {
  const timing = raceRoundTiming(0);
  const round = { ...timing, odds: raceOdds(DEFAULT_RACE_CONFIG) };
  expect(nextRaceRefreshDelay({ ...round, phase: 'betting' }, 0)).toBe(30100);
  expect(nextRaceRefreshDelay({ ...round, phase: 'countdown' }, 30000)).toBe(5100);
  expect(nextRaceRefreshDelay({ ...round, phase: 'racing' }, 35000)).toBe(20100);
  expect(nextRaceRefreshDelay({ ...round, phase: 'results' }, 55000)).toBe(7100);
  expect(nextRaceRefreshDelay({ ...round, phase: 'betting' }, 40000)).toBe(100);
});
