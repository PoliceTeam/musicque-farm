import { Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
import type { JobQueue } from './ports.js';

/** Redis transport only. This adapter never imports application schemas, rules or realtime packages. */
export function createBullMqQueue(options: {
  url: string;
  name: string;
  prefix?: string;
  concurrency?: number;
  cluster?: boolean;
}): JobQueue {
  const parsed = new URL(options.url);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) throw new Error('Job queue requires a Redis URL');
  if (options.cluster && parsed.pathname && parsed.pathname !== '/0' && parsed.pathname !== '/')
    throw new Error('Redis Cluster jobs must use database 0');
  const connection = options.cluster
    ? new Cluster([{ host: parsed.hostname, port: Number(parsed.port || 6379) }], {
        redisOptions: {
          username: decodeURIComponent(parsed.username) || undefined,
          password: decodeURIComponent(parsed.password) || undefined,
          maxRetriesPerRequest: null,
          ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
        },
      })
    : new Redis(options.url, { maxRetriesPerRequest: null });
  const prefix = options.prefix ?? '{background-jobs}';
  const queue = new Queue(options.name, {
    connection,
    prefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    },
  });
  let worker: Worker | undefined;

  let onError: (error: unknown) => void = () => {};

  connection.on('error', (error) => onError(error));
  queue.on('error', (error) => onError(error));
  return {
    async schedule(id, schedule, job) {
      await queue.upsertJobScheduler(
        id,
        'everyMs' in schedule ? { every: schedule.everyMs } : { pattern: schedule.pattern, tz: schedule.timeZone },
        { name: job.name, data: job.data },
      );
    },

    async removeSchedule(id) {
      await queue.removeJobScheduler(id);
    },

    async consume(handler, handleError) {
      if (worker) throw new Error('Queue consumer already started');
      onError = handleError;
      worker = new Worker(options.name, async (job) => handler({ name: job.name, data: job.data }), {
        connection,
        prefix,
        concurrency: options.concurrency ?? 2,
      });
      worker.on('error', handleError);
      worker.on('failed', (_job, error) => handleError(error));
      await worker.waitUntilReady();
    },

    async close() {
      await worker?.close();
      await queue.close();
      await connection.quit();
    },
  };
}
