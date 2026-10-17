import { expect, it, vi } from 'vitest';

vi.mock('bullmq', () => {
  throw new Error('The contract entry must not load BullMQ');
});
vi.mock('ioredis', () => {
  throw new Error('The contract entry must not load Redis');
});

it('imports the root contract entry without loading an adapter or opening a connection', async () => {
  expect(Object.keys(await import('../src/index.js'))).toEqual([]);
});
