import { randomUUID } from 'node:crypto';
import type { MapPlayer } from '@chibi-town/contracts/realtime';
import type { RealtimeClient, RealtimeHub } from '@/modules/realtime/realtime-hub';
import { createMemorySharedState, type SharedState } from '@/modules/realtime/shared-state';

type Entry = { owner: string; player: MapPlayer; size: readonly [number, number] };
export const MAP_LEASE_MS = 45_000;

/** Shared leases with per-connection ownership: closing an old tab cannot remove a new tab's player. */
export function createMapRooms(hub: RealtimeHub, shared: SharedState = createMemorySharedState()) {
  const current = new Map<RealtimeClient, { topic: string; owner: string }>();

  const key = (topic: string, id: string) => `room:${topic}:${id}`;

  type Ownership = { key: string; topic: string; owner: string };

  const ownerKey = (id: string) => `room-owner:${id}`;

  const rooms = {
    async leave(client: RealtimeClient) {
      const mine = current.get(client);
      if (!mine) return;
      current.delete(client);
      hub.unsubscribe(client, mine.topic);
      await shared.exclusive('map-rooms', async () => {
        const entry = await shared.get<Entry>(key(mine.topic, client.playerId));
        if (entry?.owner !== mine.owner) return;
        await shared.delete(key(mine.topic, client.playerId));
        const owner = await shared.get<Ownership>(ownerKey(client.playerId));
        if (owner?.owner === mine.owner) await shared.delete(ownerKey(client.playerId));
        hub.publish(mine.topic, { type: 'map.leave', id: client.playerId });
      });
    },

    async enter(
      client: RealtimeClient,
      mapId: string,
      channelId: number,
      size: readonly [number, number],
      player: MapPlayer,
    ) {
      await rooms.leave(client);
      await shared.exclusive('map-rooms', async () => {
        const topic = `map:${mapId}:${channelId}`,
          owner = randomUUID();
        const previous = await shared.get<Ownership>(ownerKey(player.id));
        if (previous) {
          await shared.delete(previous.key);
          if (previous.topic !== topic) hub.publish(previous.topic, { type: 'map.leave', id: player.id });
        }
        const entries = await shared.entries<Entry>(`room:${topic}:`);
        client.send({
          type: 'map.state',
          mapId,
          channelId,
          players: entries.map(([, entry]) => entry.player).filter((entry) => entry.id !== player.id),
        });
        await shared.set(key(topic, player.id), { owner, player, size }, MAP_LEASE_MS);
        await shared.set(ownerKey(player.id), { key: key(topic, player.id), topic, owner }, MAP_LEASE_MS);
        current.set(client, { topic, owner });
        hub.publish(topic, { type: 'map.join', player });
        hub.subscribe(client, topic);
      });
    },

    async move(client: RealtimeClient, x: number, y: number) {
      const mine = current.get(client);
      if (!mine) return;
      await shared.exclusive('map-rooms', async () => {
        const entry = await shared.get<Entry>(key(mine.topic, client.playerId));
        if (entry?.owner !== mine.owner || x > entry.size[0] || y > entry.size[1]) return;
        entry.player = { ...entry.player, x, y };
        await shared.set(key(mine.topic, client.playerId), entry, MAP_LEASE_MS);
        await shared.set(ownerKey(client.playerId), { key: key(mine.topic, client.playerId), ...mine }, MAP_LEASE_MS);
        hub.publish(mine.topic, { type: 'map.move', id: client.playerId, x, y }, client);
      });
    },

    async touch(client: RealtimeClient) {
      const mine = current.get(client);
      if (!mine) return;
      await shared.exclusive('map-rooms', async () => {
        const entry = await shared.get<Entry>(key(mine.topic, client.playerId));
        if (entry?.owner !== mine.owner) {
          current.delete(client);
          hub.unsubscribe(client, mine.topic);
          return;
        }
        await shared.set(key(mine.topic, client.playerId), entry, MAP_LEASE_MS);
        await shared.set(ownerKey(client.playerId), { key: key(mine.topic, client.playerId), ...mine }, MAP_LEASE_MS);
        const [, mapId, channel] = mine.topic.split(':');
        const entries = await shared.entries<Entry>(`room:${mine.topic}:`);
        client.send({
          type: 'map.state',
          mapId,
          channelId: Number(channel),
          players: entries.map(([, value]) => value.player).filter((player) => player.id !== client.playerId),
        });
      });
    },
  };
  return rooms;
}

export type MapRooms = ReturnType<typeof createMapRooms>;
