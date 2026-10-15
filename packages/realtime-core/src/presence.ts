import type { Coordination, Store } from './ports.js';

/** Reservations made by HTTP have no transport; a socket replaces the reservation with its connection owner. */
export function createPresenceService(store: Store, coordination: Coordination, clock: () => number) {
  const ttlMs = 5 * 60_000;

  const key = (id: string) => `reservation:${id}`;

  return {
    count: (topic: string, except: string, now = clock()) => store.count(topic, except, now),

    async claim(id: string, topic: string, capacity: number, now = clock()) {
      return coordination.exclusive(key(id), async () => {
        const owner = `http:${id}`;
        if (!(await store.claim(topic, id, { owner, player: null }, capacity, now, now + ttlMs))) return false;
        const previous = await coordination.get<string>(key(id));
        if (previous && previous !== topic) await store.remove(previous, id, owner);
        await coordination.set(key(id), topic, ttlMs);
        return true;
      });
    },

    async touch(id: string, now = clock()) {
      const topic = await coordination.get<string>(key(id));
      if (topic && (await store.touch(topic, id, `http:${id}`, now, now + ttlMs)))
        await coordination.set(key(id), topic, ttlMs);
    },

    async leave(id: string) {
      const topic = await coordination.get<string>(key(id));
      if (topic) await store.remove(topic, id, `http:${id}`);
      await coordination.delete(key(id));
    },
  };
}
