import { createBullMqQueue } from '@chibi-town/jobs/bullmq';
import { createRealtimePublisher } from '@chibi-town/realtime-core';
import { createRedisAdapters } from '@chibi-town/realtime-redis';
import { createBackgroundJobs } from '@/background-jobs';
import { DEFAULT_PET_RACE_RESET, readConfig } from '@/config';
import { openDatabase } from '@/infrastructure/database/database';
import { createSharedPetRacingService } from '@/modules/arcade/pet-racing';
import { createTableService } from '@/modules/arcade/tables';

const config = readConfig();
if (config.backgroundJobs !== 'worker' || !config.redisUrl)
  throw new Error('Set BACKGROUND_JOBS_MODE=worker, PostgreSQL DATABASE_URL and REDIS_URL');
const database = await openDatabase(config.databaseUrl);
const adapters = await createRedisAdapters(config.redisUrl, 'chibi:', { cluster: config.redisCluster }).catch(
  async (error) => {
    await database.close();
    throw error;
  },
);
const publisher = createRealtimePublisher(adapters.bus);
const reset = config.petRaceReset ?? DEFAULT_PET_RACE_RESET;
const queue = createBullMqQueue({
  url: config.redisUrl,
  name: 'backend-maintenance',
  prefix: '{chibi-jobs}',
  concurrency: config.workerConcurrency,
  cluster: config.redisCluster,
});
const logger = { error: (error: unknown) => console.error('Background job:', error) };
const jobs = createBackgroundJobs({
  queue,
  publisher,
  reset,
  onError: logger.error,
  races: createSharedPetRacingService(database.db, Date.now, reset),
  tables: createTableService({ db: database.db, clock: Date.now, realtime: publisher, logger }),
});
let closing = false;

async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    await jobs.close();
  } finally {
    try {
      await adapters.close();
    } finally {
      await database.close();
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void shutdown().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
try {
  await jobs.start();
  console.info('Background worker ready');
} catch (error) {
  await shutdown();
  throw error;
}
