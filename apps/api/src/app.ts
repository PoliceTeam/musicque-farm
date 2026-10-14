import type { SdkErrorCode } from '@chibi-town/contracts';
import { createGameService } from '@chibi-town/game-service';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { HttpError, sdkErrorStatus } from '@/_utils/http-errors';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { ApiConfig } from '@/config';
import type { Database } from '@/db/database';
import { registerAuthRoutes } from '@/modules/auth/auth-routes';
import { arcadeChannel } from '@/modules/game/arcade-channel';
import { createChannelPresence } from '@/modules/game/channel-presence';
import { registerGameRoutes } from '@/modules/game/game-routes';
import { withPlayerDocument } from '@/modules/game/player-document-repository';
import { createRealtimeHub } from '@/modules/realtime/realtime-hub';
import { registerRealtimeRoutes } from '@/modules/realtime/realtime-routes';
import { createMemorySharedState, createRedisSharedState, type SharedState } from '@/modules/realtime/shared-state';
import { createTableService, lobbyTopic } from '@/modules/tables/table-service';

export type AppDependencies = {
  shared?: SharedState;
  db: Database;
  config: ApiConfig;
  clock?: () => number;
  fetch?: typeof fetch;
  logger?: boolean;
  /** Milliseconds between table sweeps; 0 leaves sweeping to the caller (tests). */
  sweepMs?: number;
  /** How long a disconnected player keeps a seat at a table that has not started. */
  goneAfterMs?: number;
};

export async function createApp(deps: AppDependencies) {
  const { db, config } = deps;
  const clock = deps.clock ?? Date.now;
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 64 * 1024, trustProxy: config.trustProxy });
  await app.register(cookie);
  await app.register(websocket, { options: { maxPayload: 4096 } });

  /** Only the game origin may call with cookies; everything else gets no CORS headers. */
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin !== config.webOrigin) return;
    reply.header('Access-Control-Allow-Origin', config.webOrigin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET, POST');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
      reply.header('Access-Control-Max-Age', '600');
      return reply.code(204).send();
    }
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    const failure = error as { name?: string; code?: string; statusCode?: number };
    if (error instanceof HttpError)
      return reply.code(error.status).send({
        code: error.code,
        ...(error.nextAllowedAt !== undefined ? { nextAllowedAt: error.nextAllowedAt } : {}),
      });
    if (failure.name === 'ApiSdkError')
      return reply.code(sdkErrorStatus(failure.code as SdkErrorCode)).send({ code: failure.code });
    if (failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500)
      return reply.code(failure.statusCode).send({ code: 'INVALID_COMMAND' });
    request.log.error(error);
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND' }));

  const shared =
    deps.shared ?? (config.redisUrl ? await createRedisSharedState(config.redisUrl) : createMemorySharedState(clock));
  const presence = createChannelPresence(undefined, shared);
  const hub = createRealtimeHub(shared);
  app.addHook('onClose', async () => {
    hub.close();
    if (!deps.shared) await shared.close();
  });

  /** Each request runs the shared rules against that player's stored save, with the server clock. */
  const serviceFor = async (player: PlayerAccount) => {
    const population = await presence.population(player.id, clock());
    return createGameService({
      player,
      clock,
      live: true,

      channelPopulation: (mapId, channelId, capacity) => Math.min(capacity, population(mapId, channelId)),
    });
  };

  /** Arcade tables belong to the entertainment-street channel the player last chose. */
  const watchedLobby = async (player: PlayerAccount, gameId: string) =>
    lobbyTopic(gameId, await withPlayerDocument(db, player.id, arcadeChannel));

  const tables = createTableService({ db, clock, hub });
  const sweepMs = deps.sweepMs ?? 5000;
  if (sweepMs > 0) {
    const timer = setInterval(() => void tables.sweep().catch((error) => app.log.error(error)), sweepMs);
    app.addHook('onClose', async () => clearInterval(timer));
  }
  await app.register(
    async (api) => {
      registerAuthRoutes(api, { db, config, clock, fetch: deps.fetch ?? fetch, shared });
      registerGameRoutes(api, { db, clock, presence, serviceFor, tables });
      registerRealtimeRoutes(api, {
        db,
        config,
        clock,
        hub,
        presence,
        shared,
        serviceFor,
        lobbyTopic: watchedLobby,
        goneAfterMs: deps.goneAfterMs ?? 20_000,

        onGone: (playerId) => void tables.releaseWaiting(playerId).catch((error) => app.log.error(error)),
      });
    },
    { prefix: '/api' },
  );
  // Not merged into `app`: a Fastify instance is thenable, so awaiting it would drop extra properties.
  return { app, tables };
}
