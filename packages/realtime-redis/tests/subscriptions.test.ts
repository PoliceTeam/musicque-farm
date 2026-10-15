import { afterEach, expect, it, vi } from 'vitest';
import { createRedisAdapters } from '../src/index.js';
import { openRedisClient, type RedisClient } from '../src/redis-client.js';

vi.mock('../src/redis-client.js', () => ({ openRedisClient: vi.fn() }));

afterEach(() => vi.resetAllMocks());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function harness() {
  const subscriber = {
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    on: vi.fn(),
    subscribe: vi.fn<RedisClient['subscribe']>(async () => {}),
    unsubscribe: vi.fn<RedisClient['unsubscribe']>(async () => {}),
  };
  const client = {
    ...subscriber,

    duplicate: () => subscriber,
  };
  // Only connection lifecycle and subscription I/O are exercised by this fake.
  vi.mocked(openRedisClient).mockResolvedValue(client as unknown as RedisClient);
  const adapters = await createRedisAdapters('redis://fake');
  return { adapters, subscriber };
}

it('subscribes unrelated topics concurrently while one Redis acknowledgement is delayed', async () => {
  const { adapters, subscriber } = await harness();
  const blocked = deferred();
  subscriber.subscribe.mockImplementation(async (topic) => {
    if (topic === 'chibi:events:slow') await blocked.promise;
  });
  const slow = adapters.bus.subscribe('slow', () => {});
  const others = Array.from({ length: 20 }, (_, i) => adapters.bus.subscribe(`topic-${i}`, () => {}));
  let completed = 0;
  const ready = Promise.all(others).then(() => {
    completed = others.length;
  });
  try {
    await vi.waitFor(() => expect(completed).toBe(20));
    expect(subscriber.subscribe).toHaveBeenCalledTimes(21);
  } finally {
    blocked.resolve();
    await Promise.all([slow, ready]);
    await adapters.close();
  }
});

it('orders unsubscribe and rejoin within a topic without blocking another topic', async () => {
  const { adapters, subscriber } = await harness();
  const blocked = deferred();
  const callbacks = new Map<string, (raw: string) => void>();
  subscriber.subscribe.mockImplementation(async (topic, listener) => {
    callbacks.set(topic, listener);
  });
  subscriber.unsubscribe.mockImplementation(async (topic) => {
    await blocked.promise;
    callbacks.delete(topic);
  });
  const oldListener = vi.fn(),
    newListener = vi.fn();
  const stop = await adapters.bus.subscribe('same', oldListener);
  const leaving = stop();
  await vi.waitFor(() => expect(subscriber.unsubscribe).toHaveBeenCalledOnce());
  const rejoining = adapters.bus.subscribe('same', newListener);
  const unrelated = adapters.bus.subscribe('other', () => {});
  try {
    await vi.waitFor(() => expect(callbacks.has('chibi:events:other')).toBe(true));
    expect(subscriber.subscribe.mock.calls.filter(([topic]) => topic === 'chibi:events:same')).toHaveLength(1);
    blocked.resolve();
    await rejoining;
    callbacks.get('chibi:events:same')!('after-rejoin');
    expect(oldListener).not.toHaveBeenCalled();
    expect(newListener).toHaveBeenCalledExactlyOnceWith('after-rejoin');
  } finally {
    blocked.resolve();
    await Promise.all([leaving, rejoining, unrelated]);
    await adapters.close();
  }
});
