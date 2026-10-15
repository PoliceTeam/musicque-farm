import { MAPS } from '@chibi-town/game-content';
import type { RealtimeService } from '@chibi-town/realtime-core';

const topic = (mapId: string, channelId: number) => `map:${mapId}:${channelId}`;

export function createChannelPresence(presence: RealtimeService['presence']) {
  return {
    claim: (playerId: string, mapId: string, channelId: number, capacity: number, now: number) =>
      presence.claim(playerId, topic(mapId, channelId), capacity, now),

    touch: presence.touch,
    leave: presence.leave,

    async population(playerId: string, now: number) {
      const counts = new Map<string, number>();
      await Promise.all(
        MAPS.flatMap((map) =>
          Array.from({ length: map.channels?.count ?? 0 }, async (_, id) => {
            const name = topic(map.id, id);
            counts.set(name, await presence.count(name, playerId, now));
          }),
        ),
      );
      return (mapId: string, channelId: number) => counts.get(topic(mapId, channelId)) ?? 0;
    },
  };
}

export type ChannelPresence = ReturnType<typeof createChannelPresence>;
