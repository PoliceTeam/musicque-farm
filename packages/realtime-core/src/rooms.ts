import { CONNECTION_POLICY } from './_utils/connection-policy.js';
import type { Connection, Coordination, Store } from './ports.js';

type Location = { topic: string; owner: string };

export function createRoomService(
  store: Store,
  coordination: Coordination,
  clock: () => number,
  leaseUntil = (_connection: Connection) => clock() + CONNECTION_POLICY.leaseMs,
) {
  const current = new Map<string, Location>();

  const key = (id: string) => `room-owner:${id}`;

  return {
    location: (connection: Connection) => current.get(connection.id),

    members: <T>(topic: string) => store.members<T>(topic, clock()),

    takeChanges: <T>(topic: string, intervalMs: number) => store.takeChanges<T>(topic, clock(), intervalMs),

    async enter<T>(connection: Connection, topic: string, player: T, capacity: number) {
      const id = connection.identity.playerId;
      return coordination.exclusive(key(id), async () => {
        const previous = await coordination.get<Location>(key(id));
        const now = clock();
        if (!(await store.claim(topic, id, { owner: connection.id, player }, capacity, now, leaseUntil(connection))))
          return undefined;
        if (previous && previous.topic !== topic) await store.remove(previous.topic, id, previous.owner);
        const location = { topic, owner: connection.id };
        await coordination.set(key(id), location);
        current.set(connection.id, location);
        return { previous, members: await store.members<T>(topic, now) };
      });
    },

    async update<T>(connection: Connection, player: T) {
      const mine = current.get(connection.id);
      return mine
        ? store.update(mine.topic, connection.identity.playerId, { owner: connection.id, player }, clock())
        : false;
    },

    async touch(connection: Connection, until: number) {
      const mine = current.get(connection.id);
      return !mine || store.touch(mine.topic, connection.identity.playerId, connection.id, clock(), until);
    },

    async leave(connection: Connection) {
      const mine = current.get(connection.id);
      if (!mine) return undefined;
      current.delete(connection.id);
      const id = connection.identity.playerId;
      return coordination.exclusive(key(id), async () => {
        if (!(await store.remove(mine.topic, id, connection.id))) return undefined;
        const owner = await coordination.get<Location>(key(id));
        if (owner?.owner === connection.id) await coordination.delete(key(id));
        return mine.topic;
      });
    },
  };
}
