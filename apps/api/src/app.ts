import { randomUUID } from 'node:crypto';
import type { SdkErrorCode } from '@chibi-town/contracts';
import { decodeRealtimeCommand } from '@chibi-town/contracts/realtime';
import { SocialError } from '@chibi-town/contracts/social';
import { type Adapters, createMemoryAdapters, createRealtimeService } from '@chibi-town/realtime-core';
import { createFastifyWsTransport } from '@chibi-town/realtime-fastify-ws';
import { createRedisAdapters } from '@chibi-town/realtime-redis';
import cookie from '@fastify/cookie';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { HttpError, sdkErrorStatus } from '@/_utils/http-errors';
import type { PlayerAccount } from '@/_utils/session-auth';
import { hashSessionToken, readSessionHash, readSessionState, SESSION_COOKIE } from '@/_utils/session-auth';
import type { ApiConfig } from '@/config';
import type { Database } from '@/infrastructure/database/database';
import {
  arcadeChannel,
  arcadeModule,
  createArcadeService,
  PET_RACE_TOPIC,
  registerArcadeRealtime,
} from '@/modules/arcade';
import { createTableService, lobbyTopic } from '@/modules/arcade/tables';
import { authModule, createSessionHook } from '@/modules/auth';
import { commandsModule } from '@/modules/commands';
import { createFarmService, farmModule } from '@/modules/farm';
import { createInventoryService, inventoryModule } from '@/modules/inventory';
import { createPlayerService, playerModule, withPlayerDocument } from '@/modules/player';
import { registerSocialRealtime, socialModule } from '@/modules/social';
import {
  createChannelPresence,
  createJewelerAccess,
  createWorldService,
  registerPublicChat,
  registerWorldRealtime,
  worldModule,
} from '@/modules/world';

export type AppDependencies = {
  adapters?: Adapters;
  db: Database;
  config: ApiConfig;
  clock?: () => number;
  fetch?: typeof fetch;
  logger?: FastifyServerOptions['logger'];
  /** Milliseconds between table/pet-race maintenance sweeps; 0 leaves sweeping to the caller (tests). */
  sweepMs?: number;
  /** How long a disconnected player keeps a seat at a table that has not started. */
  goneAfterMs?: number;
};

export async function createApp(deps: AppDependencies) {
  const { db, config } = deps;
  const clock = deps.clock ?? Date.now;
  const app = Fastify({
    logger: deps.logger ?? false,

    genReqId: () => randomUUID(),

    bodyLimit: 64 * 1024,
    trustProxy: config.trustProxy,
  });
  await app.register(cookie);

  /** Only the game origin may call with cookies; everything else gets no CORS headers. */
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    if (request.headers.origin !== config.webOrigin) return;
    reply.header('Access-Control-Allow-Origin', config.webOrigin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Expose-Headers', 'X-Request-Id');
    reply.header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET, POST');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
      reply.header('Access-Control-Max-Age', '600');
      return reply.code(204).send();
    }
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    const failure = error as { name?: string; code?: string; statusCode?: number; reason?: string };
    if (error instanceof SocialError)
      return reply.code(409).send({
        code: error.code,
        ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    if (error instanceof HttpError)
      return reply.code(error.status).send({
        code: error.code,
        ...(error.nextAllowedAt !== undefined ? { nextAllowedAt: error.nextAllowedAt } : {}),
      });
    if (failure.name === 'ApiSdkError') {
      request.log.warn({ code: failure.code, reason: failure.reason }, 'game operation rejected');
      return reply.code(sdkErrorStatus(failure.code as SdkErrorCode)).send({ code: failure.code });
    }
    if (failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500)
      return reply.code(failure.statusCode).send({ code: 'INVALID_COMMAND' });
    request.log.error(error);
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND' }));

  if (process.env.NODE_ENV === 'production' && !config.redisUrl)
    app.log.warn(
      'REDIS_URL is unset: realtime/presence coordination is limited to this API instance; configure Redis before running multiple instances.',
    );

  const adapters =
    deps.adapters ??
    (config.redisUrl
      ? await createRedisAdapters(config.redisUrl, 'chibi:', { cluster: config.redisCluster })
      : createMemoryAdapters(clock));
  const transport = await createFastifyWsTransport(app, {
    path: '/api/ws',

    async authenticate(request) {
      if (request.headers.origin !== config.webOrigin) throw new HttpError(401, 'UNAUTHENTICATED');
      const token = request.cookies[SESSION_COOKIE];
      const session = await readSessionState(db, token, clock());
      if (!session) throw new HttpError(401, 'UNAUTHENTICATED');
      return {
        playerId: session.player.id,
        sessionId: hashSessionToken(token!),
        expiresAt: session.expiresAt,
        context: session.player,
      };
    },
  });
  const realtime = createRealtimeService({
    ...adapters,
    transport,
    clock,

    decode: (raw) => decodeRealtimeCommand(JSON.parse(raw)),

    async validateSession(connection) {
      const session = await readSessionHash(db, connection.identity.sessionId, clock());
      return session?.player.id === connection.identity.playerId ? session.expiresAt : undefined;
    },

    onError: (error) => app.log.error(error),

    goneAfterMs: deps.goneAfterMs,

    onGone: (playerId) => void tables.releaseWaiting(playerId).catch((error) => app.log.error(error)),
  });
  const presence = createChannelPresence(realtime.presence);
  app.addHook('onClose', async () => {
    await realtime.close();
    if (!deps.adapters) await adapters.close();
  });

  /** Arcade tables belong to the entertainment-street channel the player last chose. */
  const watchedLobby = async (player: PlayerAccount, gameId: string) =>
    lobbyTopic(gameId, await withPlayerDocument(db, player.id, arcadeChannel, undefined, clock));

  const tables = createTableService({ db, clock, realtime, logger: app.log });
  const player = createPlayerService({ db, clock });
  const farm = createFarmService({ db, clock });
  const inventory = createInventoryService({ db, clock, checkJewelerAccess: createJewelerAccess(realtime.rooms) });
  const world = createWorldService({ db, clock, presence });
  const arcade = createArcadeService({ db, clock, tables, petRaceReset: config.petRaceReset });
  if (config.backgroundJobs !== 'worker') await arcade.initializePetRaces();
  registerWorldRealtime(realtime, world, clock);
  registerPublicChat(realtime, { clock, coordination: adapters.coordination, resolveScope: world.getChatScope });
  registerSocialRealtime(realtime);
  registerArcadeRealtime(realtime, watchedLobby);
  const sweepMs = deps.sweepMs ?? 5000;
  if (sweepMs > 0 && config.backgroundJobs !== 'worker') {
    const timer = setInterval(() => {
      void tables.sweep().catch((error) => app.log.error(error));
      void arcade.sweepPetRaces().catch((error) => app.log.error(error));
      void arcade
        .takePetRacePhase()
        .then((event) => event && realtime.publish(PET_RACE_TOPIC, event))
        .catch((error) => app.log.error(error));
    }, sweepMs);
    app.addHook('onClose', async () => clearInterval(timer));
  }
  await app.register(
    async (api) => {
      await api.register(authModule, {
        db,
        config,
        clock,
        fetch: deps.fetch ?? fetch,
        shared: adapters.coordination,
        revokeSession: realtime.revokeSession,
      });
      await api.register(async (protectedApi) => {
        protectedApi.decorateRequest('player', null);
        protectedApi.addHook('preHandler', createSessionHook({ db, clock, presence }));
        await protectedApi.register(playerModule, { service: player });
        await protectedApi.register(socialModule, { db, clock, realtime });
        await protectedApi.register(farmModule, { service: farm });
        await protectedApi.register(inventoryModule, { service: inventory });
        await protectedApi.register(worldModule, { service: world });
        await protectedApi.register(arcadeModule, { service: arcade });
        await protectedApi.register(commandsModule, { farm, inventory });
      });
    },
    { prefix: '/api' },
  );
  // Not merged into `app`: a Fastify instance is thenable, so awaiting it would drop extra properties.
  return { app, tables };
}
