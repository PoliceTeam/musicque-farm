import { createMemorySharedState, type SharedState } from '@/infrastructure/realtime/shared-state';

type Member = { mapId: string; channelId: number; seenAt: number };

export function createChannelPresence(ttlMs = 5 * 60_000, shared: SharedState = createMemorySharedState()) {
  const key = (playerId: string) => `presence:${playerId}`;

  return {
    claim(playerId: string, mapId: string, channelId: number, capacity: number, now: number) {
      return shared.claimPresence(playerId, mapId, channelId, capacity, now, ttlMs);
    },

    async touch(playerId: string, now: number) {
      await shared.exclusive('presence', async () => {
        const member = await shared.get<Member>(key(playerId));
        if (member) await shared.set(key(playerId), { ...member, seenAt: now }, ttlMs);
      });
    },

    async enter(playerId: string, mapId: string, channelId: number, now: number) {
      await shared.exclusive('presence', () => shared.set(key(playerId), { mapId, channelId, seenAt: now }, ttlMs));
    },

    async leave(playerId: string) {
      await shared.exclusive('presence', () => shared.delete(key(playerId)));
    },

    async population(playerId: string, now: number) {
      const members = await shared.entries<Member>('presence:');
      return (mapId: string, channelId: number) =>
        members.filter(
          ([id, m]) =>
            id !== key(playerId) && now - m.seenAt <= ttlMs && m.mapId === mapId && m.channelId === channelId,
        ).length;
    },

    async others(playerId: string, mapId: string, channelId: number, now: number) {
      return (await this.population(playerId, now))(mapId, channelId);
    },

    exclusive<T>(_mapId: string, task: () => Promise<T>): Promise<T> {
      return shared.exclusive('channel-join', task);
    },
  };
}

export type ChannelPresence = ReturnType<typeof createChannelPresence>;
