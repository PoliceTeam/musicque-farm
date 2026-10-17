import { ApiSdkError } from '@chibi-town/contracts';
import { type FriendAction, isPlayerId } from '@chibi-town/contracts/social';
import type { RealtimeService } from '@chibi-town/realtime-core';
import type { FastifyPluginAsync } from 'fastify';
import type { Database } from '@/infrastructure/database/database';
import { changeFriendship, friendList, publicPlayer, relationship } from '@/modules/social/repository';

const topic = (id: string) => `social:${id}`;

export function registerSocialRealtime(realtime: RealtimeService) {
  realtime.handle(
    'social.watch',
    async (connection) => {
      await realtime.subscribe(connection, topic(connection.identity.playerId));
    },
    { expensive: true },
  );
}

export const socialModule: FastifyPluginAsync<{
  db: Database;
  clock: () => number;
  realtime: RealtimeService;
}> = async (app, { db, clock, realtime }) => {
  app.get('/social/friends', (request) => friendList(db, request.player!.id));
  app.get<{ Params: { id: string } }>('/social/players/:id', async (request) => {
    const id = request.params.id.toLowerCase();
    if (!isPlayerId(id)) throw new ApiSdkError('INVALID_COMMAND');
    return { ...(await publicPlayer(db, id)), relationship: await relationship(db, request.player!.id, id) };
  });
  app.post('/social/friends', async (request) => {
    const input = request.body as { targetId?: unknown; action?: unknown };
    if (
      !input ||
      !isPlayerId(input.targetId) ||
      typeof input.action !== 'string' ||
      !['request', 'accept', 'decline', 'cancel', 'remove'].includes(input.action) ||
      input.targetId.toLowerCase() === request.player!.id
    )
      throw new ApiSdkError('INVALID_COMMAND');
    const targetId = input.targetId.toLowerCase();
    await changeFriendship(db, request.player!.id, targetId, input.action as FriendAction, clock());
    // Notifications are hints after commit. Persisted state remains authoritative if delivery fails.
    await Promise.allSettled(
      [request.player!.id, targetId].map((id) => realtime.publish(topic(id), { type: 'social.changed' })),
    );
    return { relationship: await relationship(db, request.player!.id, targetId) };
  });
};
