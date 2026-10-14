import { randomUUID } from 'node:crypto';
import { openRedisClient } from '@/modules/realtime/redis-client';

/** Small coordination boundary. Values are disposable leases, never game saves. */
export interface SharedState {
  claimPresence(
    playerId: string,
    mapId: string,
    channelId: number,
    capacity: number,
    now: number,
    ttlMs: number,
  ): Promise<boolean>;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  entries<T>(prefix: string): Promise<[string, T][]>;
  exclusive<T>(key: string, task: () => Promise<T>): Promise<T>;
  publish(message: string): Promise<void>;
  subscribe(listener: (message: string) => void): () => void;
  close(): Promise<void>;
}

/** Share one instance between apps to exercise the same boundaries without a Redis server. */
export function createMemorySharedState(clock = Date.now): SharedState {
  const values = new Map<string, { value: string; until: number }>();
  const queues = new Map<string, Promise<unknown>>();
  const listeners = new Set<(message: string) => void>();
  const state: SharedState = {
    async claimPresence(playerId, mapId, channelId, capacity, now, ttlMs) {
      return state.exclusive('presence', async () => {
        const members = await state.entries<{ mapId: string; channelId: number; seenAt: number }>('presence:');
        const others = members.filter(
          ([id, m]) =>
            id !== `presence:${playerId}` && m.mapId === mapId && m.channelId === channelId && now - m.seenAt <= ttlMs,
        ).length;
        if (others >= capacity) return false;
        await state.set(`presence:${playerId}`, { mapId, channelId, seenAt: now }, ttlMs);
        return true;
      });
    },

    async get<T>(key: string) {
      const entry = values.get(key);
      if (!entry || entry.until <= clock()) {
        values.delete(key);
        return undefined;
      }
      return JSON.parse(entry.value) as T;
    },

    async set(key, value, ttlMs) {
      values.set(key, { value: JSON.stringify(value), until: clock() + ttlMs });
    },

    async delete(key) {
      values.delete(key);
    },

    async entries<T>(prefix: string) {
      const result: [string, T][] = [];
      for (const key of values.keys())
        if (key.startsWith(prefix)) {
          const value = await state.get<T>(key);
          if (value !== undefined) result.push([key, value]);
        }
      return result;
    },

    async exclusive<T>(key: string, task: () => Promise<T>) {
      const result = (queues.get(key) ?? Promise.resolve()).then(task, task);
      const tail = result.catch(() => {});
      queues.set(key, tail);
      try {
        return await result;
      } finally {
        if (queues.get(key) === tail) queues.delete(key);
      }
    },

    async publish(message) {
      for (const listener of listeners) listener(message);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async close() {
      listeners.clear();
      values.clear();
    },
  };
  return state;
}

export async function createRedisSharedState(url: string, prefix = 'chibi:'): Promise<SharedState> {
  const client = await openRedisClient(url);
  const subscriber = client.duplicate();
  // Clients must have error listeners, including during reconnect. Requests fail closed on Redis errors.
  client.on('error', (error) => console.error('Redis coordination:', error));
  subscriber.on('error', (error) => console.error('Redis subscription:', error));
  await client.connect();
  await subscriber.connect();
  const listeners = new Set<(message: string) => void>();
  await subscriber.subscribe(`${prefix}events`, (message) => {
    for (const listener of listeners) listener(message);
  });
  const unlock = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
  const renew =
    "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end";
  const claim = `
    local cursor = '0'
    local count = 0
    local visited = {}
    repeat
      local batch = redis.call('SCAN', cursor, 'MATCH', ARGV[1] .. 'presence:*', 'COUNT', 100)
      cursor = batch[1]
      for _, key in ipairs(batch[2]) do
        if key ~= KEYS[1] and not visited[key] then
          visited[key] = true
          local raw = redis.call('GET', key)
          if raw then
            local member = cjson.decode(raw)
            if member.mapId == ARGV[2] and member.channelId == tonumber(ARGV[3]) and tonumber(ARGV[5]) - member.seenAt <= tonumber(ARGV[6]) then count = count + 1 end
          end
        end
      end
    until cursor == '0'
    if count >= tonumber(ARGV[4]) then return 0 end
    redis.call('SET', KEYS[1], ARGV[7], 'PX', ARGV[6])
    return 1`;
  return {
    async claimPresence(playerId, mapId, channelId, capacity, now, ttlMs) {
      return (
        (await client.eval(claim, {
          keys: [`${prefix}presence:${playerId}`],
          arguments: [
            prefix,
            mapId,
            String(channelId),
            String(capacity),
            String(now),
            String(ttlMs),
            JSON.stringify({ mapId, channelId, seenAt: now }),
          ],
        })) === 1
      );
    },

    async get<T>(key: string) {
      const value = await client.get(prefix + key);
      return value === null ? undefined : (JSON.parse(value) as T);
    },

    async set(key, value, ttlMs) {
      await client.set(prefix + key, JSON.stringify(value), { PX: ttlMs });
    },

    async delete(key) {
      await client.del(prefix + key);
    },

    async entries<T>(keyPrefix: string) {
      const result: [string, T][] = [];
      for await (const keys of client.scanIterator({ MATCH: `${prefix}${keyPrefix}*`, COUNT: 100 })) {
        for (const key of keys) {
          const value = await client.get(key);
          if (value !== null) result.push([key.slice(prefix.length), JSON.parse(value) as T]);
        }
      }
      return result;
    },

    async exclusive<T>(key: string, task: () => Promise<T>) {
      const lockKey = `${prefix}lock:${key}`,
        token = randomUUID();
      const deadline = Date.now() + 15_000;
      while (!(await client.set(lockKey, token, { NX: true, PX: 30_000 }))) {
        if (Date.now() >= deadline) throw new Error('Shared state lock timed out');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      let lost = false;
      const timer = setInterval(() => {
        void client
          .eval(renew, { keys: [lockKey], arguments: [token, '30000'] })
          .then((ok) => {
            if (!ok) lost = true;
          })
          .catch(() => {
            lost = true;
          });
      }, 5000);
      timer.unref();
      try {
        const result = await task();
        if (lost) throw new Error('Shared state lock expired');
        return result;
      } finally {
        clearInterval(timer);
        await client.eval(unlock, { keys: [lockKey], arguments: [token] });
      }
    },

    async publish(message) {
      await client.publish(`${prefix}events`, message);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async close() {
      await subscriber.close();
      await client.close();
    },
  };
}
