import { RACE_CYCLE, racePayout } from '@chibi-town/contracts/pet-racing';
import type { Job, JobQueue, JobSchedule } from '@chibi-town/jobs';
import { createMemoryAdapters, createRealtimePublisher } from '@chibi-town/realtime-core';
import { eq } from 'drizzle-orm';
import { expect, it, vi } from 'vitest';
import { BACKGROUND_JOBS, createBackgroundJobs } from '@/background-jobs';
import { DEFAULT_PET_RACE_RESET, readConfig } from '@/config';
import { petRaceRounds } from '@/infrastructure/database/schema';
import { createSharedPetRacingService, PET_RACE_TOPIC } from '@/modules/arcade/pet-racing';
import { createTestApp } from './test-app';

function fakeQueue() {
  const schedules: { id: string; schedule: JobSchedule; job: Job }[] = [];
  const removed: string[] = [];
  const queue: JobQueue = {
    async schedule(id, schedule, job) {
      schedules.push({ id, schedule, job });
    },

    async removeSchedule(id) {
      removed.push(id);
    },

    consume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return { queue, schedules, removed };
}

it('schedules background jobs, claims each phase once, recovers offline payouts and never publishes secrets', async () => {
  const app = await createTestApp();
  const adapters = createMemoryAdapters();
  const seen: unknown[] = [];
  const stop = await adapters.bus.subscribe(PET_RACE_TOPIC, (raw) => seen.push(JSON.parse(JSON.parse(raw).data)));
  const { queue, schedules } = fakeQueue();
  const races = createSharedPetRacingService(app.db, app.clock);
  const tables = { sweep: vi.fn(async () => true) };
  const jobs = createBackgroundJobs({
    queue,
    races,
    tables,
    publisher: createRealtimePublisher(adapters.bus),
    reset: DEFAULT_PET_RACE_RESET,
    onError: vi.fn(),
  });
  try {
    app.advance((Math.floor(app.clock() / RACE_CYCLE) + 1) * RACE_CYCLE - app.clock());
    const player = await app.register('worker-payout');
    const sdk = app.sdkFor(player.cookie);
    const initial = await sdk.getPetRace();
    const [stored] = await app.db.select().from(petRaceRounds).where(eq(petRaceRounds.id, initial.round.id));
    await sdk.betPetRace({
      requestId: 'worker-payout',
      roundId: initial.round.id,
      pet: stored.record.winner,
      stake: 100,
    });
    await jobs.start();
    expect(schedules).toHaveLength(4);
    expect(schedules.find((entry) => entry.id === BACKGROUND_JOBS.reset)?.schedule).toEqual({
      pattern: '0 0 * * *',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    await Promise.all([
      jobs.handle({ name: BACKGROUND_JOBS.phase, data: {} }),
      jobs.handle({ name: BACKGROUND_JOBS.phase, data: {} }),
    ]);
    expect(seen).toEqual([{ type: 'pet-race.changed', roundId: initial.round.id, phase: 'betting' }]);
    app.advance(initial.round.startsAt - app.clock());
    await jobs.handle({ name: BACKGROUND_JOBS.phase, data: {} });
    expect(seen).toHaveLength(2);
    app.advance(initial.round.endsAt - app.clock());
    // Starting a replacement worker catches due bets even if no queue event survived the outage.
    const replacement = createBackgroundJobs({
      queue: fakeQueue().queue,
      races,
      tables,
      publisher: createRealtimePublisher(adapters.bus),
      reset: DEFAULT_PET_RACE_RESET,
      onError: vi.fn(),
    });
    await jobs.close();
    await replacement.start();
    await replacement.close();
    await jobs.handle({ name: BACKGROUND_JOBS.settle, data: {} });
    expect((await sdk.getInventory()).farm.coins).toBe(
      initial.coins - 100 + racePayout(100, initial.round.odds[stored.record.winner]),
    );
    expect(JSON.stringify(seen)).not.toMatch(/winner|finishTimes|coins|stake/);
    await jobs.handle({ name: BACKGROUND_JOBS.tables, data: {} });
    expect(tables.sweep).toHaveBeenCalled();
    await expect(jobs.handle({ name: 'bad', data: {} })).rejects.toThrow('Unknown');
    await expect(jobs.handle({ name: BACKGROUND_JOBS.reset, data: { odds: 1 } })).rejects.toThrow('payload');
  } finally {
    await jobs.close();
    await stop();
    await adapters.close();
    await app.close();
  }
});

it('removes an existing reset schedule when reset is disabled', async () => {
  const app = await createTestApp();
  const adapters = createMemoryAdapters();
  const { queue, schedules, removed } = fakeQueue();
  const reset = { ...DEFAULT_PET_RACE_RESET, enabled: false, time: '04:30' };
  const jobs = createBackgroundJobs({
    queue,
    races: createSharedPetRacingService(app.db, app.clock, reset),
    tables: { sweep: async () => false },
    publisher: createRealtimePublisher(adapters.bus),
    reset,
    onError: vi.fn(),
  });
  try {
    await jobs.start();
    expect(schedules).toHaveLength(3);
    expect(removed).toEqual([BACKGROUND_JOBS.reset]);
  } finally {
    await jobs.close();
    await adapters.close();
    await app.close();
  }
});

it('requires a shared PostgreSQL database and Redis for worker mode', () => {
  expect(() =>
    readConfig({ DATABASE_URL: 'pglite:memory', BACKGROUND_JOBS_MODE: 'worker', REDIS_URL: 'redis://localhost' }),
  ).toThrow('PostgreSQL');
  expect(() => readConfig({ DATABASE_URL: 'postgres://local/db', BACKGROUND_JOBS_MODE: 'worker' })).toThrow(
    'REDIS_URL',
  );
  expect(
    readConfig({ DATABASE_URL: 'postgres://local/db', REDIS_URL: 'redis://localhost', BACKGROUND_JOBS_MODE: 'worker' })
      .backgroundJobs,
  ).toBe('worker');
  expect(() => readConfig({ DATABASE_URL: 'pglite:memory', WORKER_CONCURRENCY: '0' })).toThrow('WORKER_CONCURRENCY');
});
