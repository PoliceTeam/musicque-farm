import type { Adapters, Coordination, RoomMember } from './ports.js';

export function createMemoryAdapters(clock = Date.now): Adapters {
  const values = new Map<string, { value: string; until: number }>();
  const queues = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<(message: string) => void>>();
  const rooms = new Map<string, Map<string, { member: RoomMember; until: number }>>();
  const changes = new Map<string, Map<string, RoomMember>>();
  const ticks = new Map<string, number>();
  const leases = new Map<string, Map<string, number>>();

  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  function room(topic: string, now: number) {
    let entries = rooms.get(topic);
    if (!entries) {
      entries = new Map();
      rooms.set(topic, entries);
    }
    for (const [id, entry] of entries)
      if (entry.until <= now) {
        entries.delete(id);
        changes.get(topic)?.delete(id);
      }
    return entries;
  }

  const coordination: Coordination = {
    async get<T>(key: string) {
      const entry = values.get(key);
      if (!entry || entry.until <= clock()) {
        values.delete(key);
        return undefined;
      }
      return JSON.parse(entry.value) as T;
    },

    async set(key, value, ttlMs) {
      values.set(key, { value: JSON.stringify(value), until: ttlMs === undefined ? Infinity : clock() + ttlMs });
    },

    async delete(key) {
      values.delete(key);
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
  };
  return {
    coordination,
    bus: {
      async publish(topic, message) {
        for (const listener of listeners.get(topic) ?? []) listener(message);
      },

      async subscribe(topic, listener) {
        if (!listeners.has(topic)) listeners.set(topic, new Set());
        listeners.get(topic)!.add(listener);
        return async () => {
          const set = listeners.get(topic);
          set?.delete(listener);
          if (!set?.size) listeners.delete(topic);
        };
      },
    },
    store: {
      async claim(topic, id, member, capacity, now, until) {
        const entries = room(topic, now);
        if (!entries.has(id) && entries.size >= capacity) return false;
        if (member.player === null && entries.get(id)?.member.player != null) return true;
        entries.set(id, { member: copy(member), until });
        changes.get(topic)?.delete(id);
        return true;
      },

      async update(topic, id, member, now) {
        const entry = room(topic, now).get(id);
        if (entry?.member.owner !== member.owner) return false;
        entry.member = copy(member);
        if (!changes.has(topic)) changes.set(topic, new Map());
        changes.get(topic)!.set(id, copy(member));
        return true;
      },

      async remove(topic, id, owner) {
        const entries = rooms.get(topic);
        if (entries?.get(id)?.member.owner !== owner) return false;
        entries.delete(id);
        changes.get(topic)?.delete(id);
        return true;
      },

      async members<T>(topic: string, now: number) {
        return Object.fromEntries([...room(topic, now)].map(([id, entry]) => [id, copy(entry.member)])) as Record<
          string,
          RoomMember<T>
        >;
      },

      async touch(topic, id, owner, now, until) {
        const entry = room(topic, now).get(id);
        if (entry?.member.owner !== owner) return false;
        entry.until = until;
        return true;
      },

      async takeChanges<T>(topic: string, now: number, intervalMs: number) {
        room(topic, now);
        const pending = changes.get(topic);
        if (!pending?.size) return {};
        if (now - (ticks.get(topic) ?? Number.NEGATIVE_INFINITY) < intervalMs) return undefined;
        ticks.set(topic, now);
        changes.delete(topic);
        return copy(Object.fromEntries(pending)) as Record<string, RoomMember<T>>;
      },

      async count(topic, except, now) {
        const entries = room(topic, now);
        return entries.size - Number(entries.has(except));
      },

      async lease(id, owner, until) {
        if (!leases.has(id)) leases.set(id, new Map());
        leases.get(id)!.set(owner, until);
      },

      async release(id, owner) {
        leases.get(id)?.delete(owner);
      },

      async connected(id, now) {
        const entries = leases.get(id);
        for (const [owner, until] of entries ?? []) if (until <= now) entries!.delete(owner);
        return Boolean(entries?.size);
      },
    },

    async close() {
      values.clear();
      listeners.clear();
      rooms.clear();
      leases.clear();
      changes.clear();
      ticks.clear();
    },
  };
}
