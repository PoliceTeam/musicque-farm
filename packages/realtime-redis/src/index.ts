import { randomUUID } from 'node:crypto';
import type { Adapters, RoomMember } from '@chibi-town/realtime-core';
import { openRedisClient } from './redis-client.js';
import { roomKeys } from './redis-keys.js';
import { connectionScript, renewScript, roomScript, unlockScript } from './scripts.js';

export async function createRedisAdapters(
  url: string,
  prefix = 'chibi:',
  options: { cluster?: boolean } = {},
): Promise<Adapters> {
  // A prefix cannot inject an earlier hash tag and accidentally place unrelated topics in one slot.
  if (/[{}]/.test(prefix)) throw new Error('Redis prefix must not contain hash tags');
  const client = await openRedisClient(url, options.cluster);
  const subscriber = client.duplicate();
  client.on('error', (error) => console.error('Redis coordination:', error));
  subscriber.on('error', (error) => console.error('Redis subscription:', error));
  await client.connect();
  try {
    await subscriber.connect();
  } catch (error) {
    await client.close();
    throw error;
  }
  const listeners = new Map<string, Set<(raw: string) => void>>();
  // Serialize transitions within each topic; unrelated subscriptions can await Redis concurrently.
  const subscriptionQueues = new Map<string, Promise<void>>();

  function subscription<T>(topic: string, task: () => Promise<T>) {
    const result = (subscriptionQueues.get(topic) ?? Promise.resolve()).then(task, task);
    const tail = result.then(
      () => {},
      () => {},
    );
    subscriptionQueues.set(topic, tail);
    void tail.then(() => {
      if (subscriptionQueues.get(topic) === tail) subscriptionQueues.delete(topic);
    });
    return result;
  }

  const room = (
    op: string,
    topic: string,
    id = '',
    owner = '',
    now = 0,
    capacity = 0,
    value: unknown = null,
    until = 0,
  ) =>
    client.eval(roomScript, {
      keys: roomKeys(prefix, topic),
      arguments: [op, id, owner, String(now), String(capacity), JSON.stringify(value), String(until)],
    });

  const connection = (op: string, id: string, owner: string, at: number) =>
    client.eval(connectionScript, {
      keys: [`${prefix}connections:{player:${encodeURIComponent(id)}}`],
      arguments: [op, owner, String(at)],
    });

  return {
    coordination: {
      async get<T>(key: string) {
        const raw = await client.get(`${prefix}kv:${key}`);
        return raw === null ? undefined : (JSON.parse(raw) as T);
      },

      async set(key, value, ttlMs) {
        await client.set(`${prefix}kv:${key}`, JSON.stringify(value), ttlMs === undefined ? undefined : { PX: ttlMs });
      },

      async delete(key) {
        await client.del(`${prefix}kv:${key}`);
      },

      async exclusive<T>(key: string, task: () => Promise<T>) {
        const lockKey = `${prefix}lock:{${encodeURIComponent(key)}}`;
        const token = randomUUID();
        const deadline = Date.now() + 15_000;
        while (!(await client.set(lockKey, token, { NX: true, PX: 30_000 }))) {
          if (Date.now() >= deadline) throw new Error('Coordination lock timed out');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        let lost = false;
        const renewals = new Set<Promise<unknown>>();
        const timer = setInterval(() => {
          const renewal = client
            .eval(renewScript, { keys: [lockKey], arguments: [token, '30000'] })
            .then((ok) => {
              if (!ok) lost = true;
            })
            .catch(() => {
              lost = true;
            });
          renewals.add(renewal);
          void renewal.finally(() => renewals.delete(renewal));
        }, 5000);
        timer.unref();
        try {
          const result = await task();
          if (lost) throw new Error('Coordination lock expired');
          return result;
        } finally {
          clearInterval(timer);
          await Promise.all(renewals);
          await client.eval(unlockScript, { keys: [lockKey], arguments: [token] });
        }
      },
    },
    store: {
      async claim(topic, id, member, capacity, now, until) {
        return (await room('claim', topic, id, member.owner, now, capacity, member, until)) === 1;
      },

      async update(topic, id, member, now) {
        return (await room('update', topic, id, member.owner, now, 0, member)) === 1;
      },

      async remove(topic, id, owner) {
        return (await room('remove', topic, id, owner)) === 1;
      },

      async touch(topic, id, owner, now, until) {
        return (await room('touch', topic, id, owner, now, 0, null, until)) === 1;
      },

      async count(topic, except, now) {
        return Number(await room('count', topic, except, '', now));
      },

      async members<T>(topic: string, now: number) {
        return decodeMembers<T>((await room('members', topic, '', '', now)) as string[]);
      },

      async takeChanges<T>(topic: string, now: number, intervalMs: number) {
        const pairs = (await room('changes', topic, '', '', now, intervalMs)) as string[] | null;
        return pairs === null ? undefined : decodeMembers<T>(pairs);
      },

      async lease(id, owner, until) {
        await connection('lease', id, owner, until);
      },

      async release(id, owner) {
        await connection('release', id, owner, 0);
      },

      async connected(id, now) {
        return Number(await connection('connected', id, '', now)) > 0;
      },
    },
    bus: {
      async publish(topic, raw) {
        await client.publish(`${prefix}events:${topic}`, raw);
      },

      async subscribe(topic, listener) {
        await subscription(topic, async () => {
          if (!listeners.has(topic)) {
            const set = new Set<(raw: string) => void>();
            set.add(listener);
            listeners.set(topic, set);
            try {
              await subscriber.subscribe(`${prefix}events:${topic}`, (raw) => {
                for (const callback of set) callback(raw);
              });
            } catch (error) {
              listeners.delete(topic);
              throw error;
            }
          } else listeners.get(topic)!.add(listener);
        });
        return () =>
          subscription(topic, async () => {
            const set = listeners.get(topic);
            set?.delete(listener);
            if (set?.size === 0) {
              listeners.delete(topic);
              await subscriber.unsubscribe(`${prefix}events:${topic}`);
            }
          });
      },
    },

    async close() {
      await Promise.all(subscriptionQueues.values());
      await subscriber.close();
      await client.close();
    },
  };
}

function decodeMembers<T>(pairs: string[]): Record<string, RoomMember<T>> {
  const members: Record<string, RoomMember<T>> = {};
  for (let i = 0; i < pairs.length; i += 2) members[pairs[i]] = JSON.parse(pairs[i + 1]);
  return members;
}
