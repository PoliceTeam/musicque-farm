import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createBullMqQueue } from '../src/bullmq.js';

it('rejects unsupported URLs and cluster database numbers without opening a connection', () => {
  expect(() => createBullMqQueue({ url: 'https://example.test', name: 'test' })).toThrow('Redis URL');
  expect(() => createBullMqQueue({ url: 'redis://localhost/1', name: 'test', cluster: true })).toThrow('database 0');
});

it.skipIf(!process.env.REDIS_URL)(
  'runs and retries a scheduled job on real Redis, then closes cleanly',
  async () => {
    const queue = createBullMqQueue({
      url: process.env.REDIS_URL!,
      name: 'queue-contract',
      prefix: `{test-${randomUUID()}}`,
      concurrency: 1,
    });
    let calls = 0;
    const errors: unknown[] = [];
    try {
      await queue.consume(
        async (job) => {
          expect(job).toEqual({ name: 'probe', data: { value: 42 } });
          calls++;
          if (calls === 1) {
            await queue.removeSchedule('probe');
            throw new Error('Retry this job');
          }
        },
        (error) => errors.push(error),
      );
      await queue.schedule('probe', { everyMs: 100 }, { name: 'probe', data: { value: 42 } });
      await vi.waitFor(
        () => {
          expect(calls).toBeGreaterThanOrEqual(2);
          expect(errors).toHaveLength(1);
        },
        { timeout: 12000 },
      );
      await queue.removeSchedule('probe');
    } finally {
      await queue.close();
    }
  },
  20000,
);
