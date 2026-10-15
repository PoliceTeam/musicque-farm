import { randomUUID } from 'node:crypto';
import { adapterContract } from '@chibi-town/realtime-core/testing';
import { describe, expect, it } from 'vitest';
import { createRedisAdapters } from '../src/index.js';
import { openRedisClient } from '../src/redis-client.js';
import { roomKeys } from '../src/redis-keys.js';

describe.skipIf(!process.env.REDIS_URL)('real Redis', () => {
  adapterContract('redis', async () => {
    const prefix = `chibi-contract:${randomUUID()}:`;
    return [
      await createRedisAdapters(process.env.REDIS_URL!, prefix),
      await createRedisAdapters(process.env.REDIS_URL!, prefix),
    ];
  });

  it('stores seenAt in presence and the same logical lease deadline in its expiry index', async () => {
    const prefix = `chibi-data-model:${randomUUID()}:`;
    const adapters = await createRedisAdapters(process.env.REDIS_URL!, prefix);
    const raw = await openRedisClient(process.env.REDIS_URL!);
    raw.on('error', console.error);
    await raw.connect();
    const keys = roomKeys(prefix, 'room');

    const scores = () =>
      raw.eval("return {redis.call('ZSCORE',KEYS[2],ARGV[1]),redis.call('ZSCORE',KEYS[3],ARGV[1])}", {
        keys,
        arguments: ['p'],
      });

    try {
      await adapters.store.claim('room', 'p', { owner: 'socket', player: { x: 0 } }, 1, 123, 999);
      expect(await scores()).toEqual(['123', '999']);
      await adapters.store.update('room', 'p', { owner: 'socket', player: { x: 1 } }, 200);
      expect(await scores()).toEqual(['123', '999']);
      await adapters.store.touch('room', 'p', 'socket', 456, 1337);
      expect(await scores()).toEqual(['456', '1337']);
    } finally {
      for (const key of keys) await raw.del(key);
      await raw.close();
      await adapters.close();
    }
  });
});
