import type { FastifyRequest } from 'fastify';
import { HttpError } from '@/_utils/http-errors';
import { type PlayerAccount, readSession, SESSION_COOKIE } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import type { ChannelPresence } from '@/modules/world';

declare module 'fastify' {
  interface FastifyRequest {
    player: PlayerAccount | null;
  }
}

export function createSessionHook(deps: { db: Database; clock: () => number; presence: ChannelPresence }) {
  return async function authenticate(request: FastifyRequest) {
    const player = await readSession(deps.db, request.cookies[SESSION_COOKIE], deps.clock());
    if (!player) throw new HttpError(401, 'UNAUTHENTICATED');
    request.player = player;
    request.log = request.log.child({ playerId: player.id });
    await deps.presence.touch(player.id, deps.clock());
  };
}
