import type { MapPlayer } from '@chibi-town/contracts/realtime';
import type { Connection, RealtimeService } from '@chibi-town/realtime-core';
import { CONNECTION_POLICY } from '@chibi-town/realtime-core/connection-policy';
import { createMoveBatches } from '@/modules/world/_utils/move-batches';
import { acceptMovement, type MovementState, startMovement } from '@/modules/world/movement-policy';

type Entry = { player: MapPlayer; size: readonly [number, number]; movement: MovementState };
export const MAP_LEASE_MS = CONNECTION_POLICY.leaseMs;

/** World owns coordinates and movement; core only sees an opaque room value and connection owner. */
export function createMapRooms(
  realtime: RealtimeService,
  clock: () => number = Date.now,
  onError: (error: unknown) => void = console.error,
) {
  const current = new Map<string, { topic: string; entry: Entry; mapId: string; channelId: number }>();

  const batches = createMoveBatches(realtime, onError);

  const rooms = {
    close: batches.close,

    async leave(client: Connection) {
      const mine = current.get(client.id);
      current.delete(client.id);
      batches.discard(client.identity.playerId, client.id);
      if (mine) await realtime.unsubscribe(client, mine.topic);
      const topic = await realtime.rooms.leave(client);
      if (topic) await realtime.publish(topic, { type: 'map.leave', id: client.identity.playerId });
    },

    async enter(
      client: Connection,
      mapId: string,
      channelId: number,
      size: readonly [number, number],
      player: MapPlayer,
      capacity = Number.MAX_SAFE_INTEGER,
    ) {
      const topic = `map:${mapId}:${channelId}`;
      const mine = current.get(client.id);
      const movement =
        mine?.topic === topic
          ? acceptMovement(mine.entry.movement, player.x, player.y, clock())
          : startMovement(player.x, player.y, clock());
      if (!movement) return true;
      const entry = { player, size, movement };
      const result = await realtime.rooms.enter(client, topic, entry, capacity);
      if (!result) return false;
      batches.discard(player.id);
      if (mine) await realtime.unsubscribe(client, mine.topic);
      if (result.previous && result.previous.topic !== topic)
        await realtime.publish(result.previous.topic, { type: 'map.leave', id: player.id });
      realtime.send(client, {
        type: 'map.state',
        mapId,
        channelId,
        players: Object.values(result.members)
          .filter((member) => member.player && member.player.player.id !== player.id)
          .map((member) => member.player.player),
      });
      current.set(client.id, { topic, entry, mapId, channelId });
      await realtime.publish(topic, { type: 'map.join', player });
      await realtime.subscribe(client, topic);
      return true;
    },

    async move(client: Connection, x: number, y: number) {
      const mine = current.get(client.id);
      if (!mine || x > mine.entry.size[0] || y > mine.entry.size[1]) return;
      const movement = acceptMovement(mine.entry.movement, x, y, clock());
      if (!movement) return;
      const entry = { ...mine.entry, movement, player: { ...mine.entry.player, x, y } };
      if (!(await realtime.rooms.update(client, entry))) return;
      mine.entry = entry;
      batches.add(mine.topic, { id: client.identity.playerId, x, y, owner: client.id });
    },

    async touch(client: Connection) {
      const mine = current.get(client.id);
      if (!mine) return;
      const members = await realtime.rooms.members<Entry>(mine.topic);
      if (members[client.identity.playerId]?.owner !== client.id) {
        current.delete(client.id);
        await realtime.unsubscribe(client, mine.topic);
        return;
      }
      realtime.send(client, {
        type: 'map.state',
        mapId: mine.mapId,
        channelId: mine.channelId,
        players: Object.values(members)
          .filter((member) => member.player && member.player.player.id !== client.identity.playerId)
          .map((member) => member.player.player),
      });
    },
  };
  return rooms;
}
