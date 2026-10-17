import {
  DEFAULT_RACE_CONFIG,
  LEGACY_RACE_ODDS,
  RACE_BETTING_DURATION,
  RACE_COUNTDOWN,
  RACE_CYCLE,
  RACE_DURATION,
  RACE_PETS,
  raceOdds,
  racePayout,
} from '@chibi-town/contracts/pet-racing';
import { createGameService, createPlayerDocument } from '@chibi-town/game-service';
import { createPetRaceRound } from '@chibi-town/game-service/arcade/pet-racing-round';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '@/app';
import { readConfig } from '@/config';
import { petRaceConfig, petRaceRounds } from '@/infrastructure/database/schema';
import { createSharedPetRacingService } from '@/modules/arcade/pet-racing';
import { maintainRaceConfig } from '@/modules/arcade/pet-racing/repository';
import { createTestApp, testConfig } from './test-app';

it('holds a wager until the common deadline and settles once with reservations respected', () => {
  let now = 0;
  const round = createPetRaceRound(0, () => 0);
  const next = createPetRaceRound(RACE_CYCLE, () => 0);
  const rules = createGameService({
    player: { id: 'race', name: 'Race', level: 1 },

    clock: () => now,

    live: true,
    petRaceRounds: [round, next],
  });
  const document = createPlayerDocument();
  document.farm.coins = 1000;
  document.tableStakes = { other: 950 };
  const input = { requestId: 'race-1', roundId: round.id, pet: 0, stake: 100 };
  expect(() => rules.betPetRace(input)(document)).toThrow('INSUFFICIENT_COINS');
  delete document.tableStakes;
  const wager = rules.betPetRace(input)(document);
  expect(wager.coins).toBe(900);
  expect(wager.round.finishTimes).toBeUndefined();
  expect(wager.lastRace).toBeUndefined();
  expect(rules.betPetRace(input)(document).coins).toBe(900);
  expect(() => rules.betPetRace({ ...input, pet: 1 })(document)).toThrow('REQUEST_CONFLICT');
  expect(() => rules.betPetRace({ ...input, requestId: 'second' })(document)).toThrow('MATCH_IN_PROGRESS');
  now = RACE_BETTING_DURATION;
  expect(rules.getPetRace()(document).round.phase).toBe('countdown');
  expect(rules.getPetRace()(document).coins).toBe(900);
  now += RACE_COUNTDOWN;
  expect(rules.getPetRace()(document).round.phase).toBe('racing');
  now = round.endsAt;
  const settled = rules.getPetRace()(document);
  expect(settled.coins).toBe(1275);
  expect(settled.lastRace?.coinDelta).toBe(275);
  expect(rules.getPetRace()(document).coins).toBe(1275);
  now = next.bettingStartsAt;
  expect(rules.betPetRace(input)(document).coins).toBe(1275);
  expect(() => rules.betPetRace({ ...input, requestId: 'late' })(document)).toThrow('MATCH_IN_PROGRESS');
  expect(rules.betPetRace({ ...input, requestId: 'new', roundId: next.id })(document).coins).toBe(1175);
});

it('covers all published odds, validates inputs and rejects bets exactly at closing', () => {
  let cumulative = 0;
  const odds = raceOdds(DEFAULT_RACE_CONFIG);
  RACE_PETS.forEach((_, index) => {
    const pet = odds[index];
    const round = createPetRaceRound(0, () => (cumulative + pet.chance / 2) / 100);
    expect(round.winner).toBe(index);
    const document = createPlayerDocument();
    document.farm.coins = 1000;
    let now = 0;
    const rules = createGameService({
      player: { id: 'r', name: 'R', level: 1 },

      clock: () => now,

      petRaceRounds: [round],
    });
    rules.betPetRace({ requestId: 'test', roundId: round.id, pet: index, stake: 10 })(document);
    now = round.endsAt;
    expect(rules.getPetRace()(document).coins).toBe(990 + racePayout(10, pet));
    cumulative += pet.chance;
  });
  const rules = createGameService({
    player: { id: 'r', name: 'R', level: 1 },

    clock: () => RACE_BETTING_DURATION,
  });
  for (const stake of [-1, 0, 9, 10.5, NaN, 100001, Infinity])
    expect(() => rules.betPetRace({ requestId: 'bad', roundId: 'race-0', pet: 0, stake })).toThrow('INVALID_COMMAND');
  expect(() =>
    rules.betPetRace({ requestId: 'late', roundId: 'race-0', pet: 0, stake: 10 })(createPlayerDocument()),
  ).toThrow('MATCH_IN_PROGRESS');
});

let app: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => app.close());

async function bettingWindow() {
  const index = Math.floor(app.clock() / RACE_CYCLE) + 1;
  app.advance(index * RACE_CYCLE - app.clock());
}

it('gives accounts on two API instances the same round, clock, order and result without leaking open outcomes', async () => {
  await bettingWindow();
  const a = await app.register('racera');
  const b = await app.register('racerb');
  const sdkA = app.sdkFor(a.cookie);
  const sdkB = app.sdkFor(b.cookie);
  const second = await createApp({ db: app.db, clock: app.clock, config: testConfig, sweepMs: 0 });
  try {
    const [initial, other] = await Promise.all([
      sdkA.getPetRace(),
      second.app.inject({ url: '/api/arcade/pet-racing', headers: { cookie: b.cookie } }),
    ]);
    expect(other.json().round).toEqual(initial.round);
    expect(initial.round).not.toHaveProperty('winner');
    expect(initial.round).not.toHaveProperty('finishTimes');
    const input = { requestId: 'http-race', roundId: initial.round.id, pet: 0, stake: 100 };
    const [bet, retried, betB] = await Promise.all([
      sdkA.betPetRace(input),
      sdkA.betPetRace(input),
      sdkB.betPetRace({ ...input, pet: 1 }),
    ]);
    expect(bet).toEqual(retried);
    expect(bet.coins).toBe(initial.coins - 100);
    expect(betB.bet?.pet).toBe(1);
    app.advance(initial.round.startsAt - app.clock());
    const [runA, runB] = await Promise.all([
      sdkA.getPetRace(),
      second.app.inject({ url: '/api/arcade/pet-racing', headers: { cookie: b.cookie } }),
    ]);
    expect(runA.round.phase).toBe('countdown');
    expect(runB.json().round).toEqual(runA.round);
    expect(runB.json().bet.pet).toBe(1);
    expect(runA.bet?.pet).toBe(0);
    const c = await app.register('racerc');
    await expect(app.sdkFor(c.cookie).betPetRace({ ...input, requestId: 'closed' })).rejects.toMatchObject({
      code: 'MATCH_IN_PROGRESS',
    });
    app.advance(RACE_DURATION);
    const doneA = await sdkA.getPetRace();
    const doneB = await sdkB.getPetRace();
    expect(doneA.lastRace?.winner).toBe(doneB.lastRace?.winner);
    expect(doneA.lastRace?.finishTimes).toEqual(doneB.lastRace?.finishTimes);
    expect(doneA.coins).toBe(initial.coins + doneA.lastRace!.coinDelta);
    expect((await sdkA.getPetRace()).coins).toBe(doneA.coins);
    expect((await sdkA.getInventory()).farm.coins).toBe(doneA.coins);
    const unauthorized = await app.app.inject({ url: '/api/arcade/pet-racing' });
    expect(unauthorized.statusCode).toBe(401);
  } finally {
    await second.app.close();
  }
});

it('sweeps offline players exactly once even when two sweepers run together', async () => {
  await bettingWindow();
  const player = await app.register('offline');
  const sdk = app.sdkFor(player.cookie);
  const initial = await sdk.getPetRace();
  await sdk.betPetRace({ requestId: 'offline', roundId: initial.round.id, pet: 0, stake: 100 });
  app.advance(initial.round.endsAt - app.clock());
  const [before] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, initial.round.id));
  const races = createSharedPetRacingService(app.db, app.clock);
  await Promise.all([races.sweep(), races.sweep()]);
  const expected = initial.coins - 100 + (before.record.winner === 0 ? racePayout(100, before.record.odds[0]) : 0);
  expect((await sdk.getInventory()).farm.coins).toBe(expected);
  await races.sweep();
  expect((await sdk.getInventory()).farm.coins).toBe(expected);
  app.advance(initial.round.nextRoundAt - app.clock());
  const next = await sdk.getPetRace();
  expect(next.round.phase).toBe('betting');
  expect(next.round.id).not.toBe(initial.round.id);
  expect(next.bet).toBeUndefined();
});

it('persists defaults, reads DB changes for new rounds, and keeps existing bets on their original terms', async () => {
  const [seed] = await app.db.select().from(petRaceConfig);
  expect(seed).toMatchObject({ id: 'default', ...DEFAULT_RACE_CONFIG });
  await bettingWindow();
  const player = await app.register('configrace');
  const sdk = app.sdkFor(player.cookie);
  const initial = await sdk.getPetRace();
  const [stored] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, initial.round.id));
  const winner = stored.record.winner;
  await sdk.betPetRace({ requestId: 'config-bet', roundId: initial.round.id, pet: winner, stake: 101 });
  const changed = { chances: [10, 20, 20, 20, 20, 10], returnRateBps: 8000 };
  try {
    await app.db.update(petRaceConfig).set(changed).where(eq(petRaceConfig.id, 'default'));
    const second = await createApp({ db: app.db, clock: app.clock, config: testConfig, sweepMs: 0 });
    try {
      const response = await second.app.inject({ url: '/api/arcade/pet-racing', headers: { cookie: player.cookie } });
      expect(response.json().round.odds).toEqual(initial.round.odds);
      // Booting another instance must not overwrite the edited settings.
      expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject(changed);
    } finally {
      await second.app.close();
    }
    app.advance(initial.round.endsAt - app.clock());
    const settled = await sdk.getPetRace();
    expect(settled.coins).toBe(initial.coins - 101 + racePayout(101, initial.round.odds[winner]));
    expect(settled.lastRace?.odds).toEqual(initial.round.odds);
    app.advance(initial.round.nextRoundAt - app.clock());
    const next = await sdk.getPetRace();
    expect(next.round.odds).toEqual(raceOdds(changed));
    const [nextStored] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, next.round.id));
    expect(nextStored.record.odds).toEqual(next.round.odds);
    expect(next.lastRace?.odds).toEqual(initial.round.odds);
    await bettingWindow();
    await app.db.update(petRaceConfig).set({ chances: [10, 20, 20, 20, 20, 9] });
    await expect(sdk.getPetRace()).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    expect((await sdk.getInventory()).farm.coins).toBe(settled.coins);
  } finally {
    await app.db.update(petRaceConfig).set(DEFAULT_RACE_CONFIG).where(eq(petRaceConfig.id, 'default'));
  }
});

it('backfills legacy round odds without changing the promised payout', async () => {
  await bettingWindow();
  const player = await app.register('legacyrace');
  const sdk = app.sdkFor(player.cookie);
  const round = createPetRaceRound(app.clock(), () => 0);
  const { odds: _odds, ...legacy } = round;
  await app.db.insert(petRaceRounds).values({ id: round.id, record: legacy as typeof round });
  const initial = await sdk.getPetRace();
  expect(initial.round.odds).toEqual(LEGACY_RACE_ODDS);
  const [backfilled] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, round.id));
  expect(backfilled.record.odds).toEqual(LEGACY_RACE_ODDS);
  await sdk.betPetRace({ requestId: 'legacy-bet', roundId: round.id, pet: 0, stake: 100 });
  app.advance(round.endsAt - app.clock());
  const settled = await sdk.getPetRace();
  expect(settled.coins).toBe(initial.coins + 300);
  expect(settled.lastRace?.coinDelta).toBe(300);
});

it('resets at Vietnamese midnight exactly once across instances and preserves a race crossing midnight', async () => {
  // This midnight falls inside the common betting window, 18 seconds into its round.
  const midnight = Date.parse('2023-11-17T17:00:00Z');
  app.advance(midnight - 1000 - app.clock());
  const custom = { chances: [10, 20, 20, 20, 20, 10], returnRateBps: 8000 };
  await app.db.update(petRaceConfig).set({ ...custom, lastResetDay: null });
  const races = createSharedPetRacingService(app.db, app.clock);
  await races.initialize();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({ ...custom, lastResetDay: '2023-11-17' });
  const player = await app.register('midnightrace');
  const sdk = app.sdkFor(player.cookie);
  const initial = await sdk.getPetRace();
  const [record] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, initial.round.id));
  await sdk.betPetRace({ requestId: 'midnight', roundId: initial.round.id, pet: record.record.winner, stake: 100 });
  app.advance(999);
  await races.sweep();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject(custom);
  app.advance(1);
  const resets = await Promise.all([maintainRaceConfig(app.db, app.clock()), maintainRaceConfig(app.db, app.clock())]);
  expect(resets.filter(Boolean)).toHaveLength(1);
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
    ...DEFAULT_RACE_CONFIG,
    lastResetDay: '2023-11-18',
  });
  expect((await sdk.getPetRace()).round.odds).toEqual(initial.round.odds);
  app.advance(initial.round.endsAt - app.clock());
  await races.sweep();
  const settled = await sdk.getPetRace();
  expect(settled.coins).toBe(initial.coins - 100 + racePayout(100, initial.round.odds[record.record.winner]));
  expect(settled.lastRace?.odds).toEqual(initial.round.odds);
  app.advance(initial.round.nextRoundAt - app.clock());
  expect((await sdk.getPetRace()).round.odds).toEqual(raceOdds(DEFAULT_RACE_CONFIG));
  // Edits after today's reset survive repeated jobs, restarts and a backwards clock.
  await app.db.update(petRaceConfig).set(custom);
  await Promise.all([races.sweep(), races.sweep()]);
  const second = await createApp({ db: app.db, clock: app.clock, config: testConfig, sweepMs: 0 });
  await second.app.close();
  expect(await maintainRaceConfig(app.db, app.clock() - 86400000)).toBe(false);
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject(custom);
});

it('catches up after downtime both at startup and before creating the next round', async () => {
  const custom = { chances: [10, 20, 20, 20, 20, 10], returnRateBps: 8000 };
  app.advance(3 * 86400000);
  const restarted = await createApp({ db: app.db, clock: app.clock, config: testConfig, sweepMs: 0 });
  await restarted.app.close();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
    ...DEFAULT_RACE_CONFIG,
    lastResetDay: '2023-11-21',
  });
  await app.db.update(petRaceConfig).set(custom);
  app.advance(86400000);
  const player = await app.register('catchuprace');
  const lobby = await app.sdkFor(player.cookie).getPetRace();
  expect(lobby.round.odds).toEqual(raceOdds(DEFAULT_RACE_CONFIG));
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
    ...DEFAULT_RACE_CONFIG,
    lastResetDay: '2023-11-22',
  });
  await app.db.update(petRaceConfig).set(custom);
  app.advance(86400000);
  await createSharedPetRacingService(app.db, app.clock).sweep();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
    ...DEFAULT_RACE_CONFIG,
    lastResetDay: '2023-11-23',
  });
});

it('disables reset through env at startup, during maintenance, and on new-round creation', async () => {
  const custom = { chances: [10, 20, 20, 20, 20, 10], returnRateBps: 8000 };
  await app.db.update(petRaceConfig).set(custom);
  const [before] = await app.db.select().from(petRaceConfig);
  app.advance(2 * 86400000);
  const policy = readConfig({ DATABASE_URL: 'unused', PET_RACE_RESET_ENABLED: 'false' }).petRaceReset!;
  const second = await createApp({
    db: app.db,
    clock: app.clock,
    config: { ...testConfig, petRaceReset: policy },
    sweepMs: 0,
  });
  try {
    await createSharedPetRacingService(app.db, app.clock, policy).sweep();
    const player = await app.register('resetdisabled');
    const response = await second.app.inject({ url: '/api/arcade/pet-racing', headers: { cookie: player.cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json().round.odds).toEqual(raceOdds(custom));
    expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
      ...custom,
      lastResetDay: before.lastResetDay,
    });
  } finally {
    await second.app.close();
  }
});

it('uses a custom reset time from env instead of midnight', async () => {
  const policy = readConfig({ DATABASE_URL: 'unused', PET_RACE_RESET_TIME: '04:30' }).petRaceReset!;
  const custom = { chances: [10, 20, 20, 20, 20, 10], returnRateBps: 8000 };
  app.advance(Date.parse('2023-11-25T21:29:59Z') - app.clock());
  await app.db.update(petRaceConfig).set({ ...custom, lastResetDay: '2023-11-25' });
  const races = createSharedPetRacingService(app.db, app.clock, policy);
  await races.sweep();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject(custom);
  app.advance(1000);
  await races.sweep();
  expect((await app.db.select().from(petRaceConfig))[0]).toMatchObject({
    ...DEFAULT_RACE_CONFIG,
    lastResetDay: '2023-11-26',
  });
});
