import { randomUUID } from 'node:crypto';
import { ApiSdkError } from '@chibi-town/contracts';
import { decodeRealtimeCommand, type RealtimeCommand } from '@chibi-town/contracts/realtime';
import { resolveMap } from '@chibi-town/game-content';
import type { GameService } from '@chibi-town/game-service';
import type { FastifyInstance } from 'fastify';
import { HttpError } from '@/_utils/http-errors';
import { type PlayerAccount, readSession, SESSION_COOKIE } from '@/_utils/session-auth';
import type { ApiConfig } from '@/config';
import type { Database } from '@/db/database';
import type { ChannelPresence } from '@/modules/game/channel-presence';
import { withPlayerDocument } from '@/modules/game/player-document-repository';
import { createMapRooms } from '@/modules/realtime/map-rooms';
import type { RealtimeHub } from '@/modules/realtime/realtime-hub';
import type { SharedState } from '@/modules/realtime/shared-state';

const MOVE_INTERVAL_MS = 80;

export function registerRealtimeRoutes(
  app: FastifyInstance,
  deps: {
    shared: SharedState;
    db: Database;
    config: ApiConfig;
    clock: () => number;
    hub: RealtimeHub;
    presence: ChannelPresence;
    serviceFor: (player: PlayerAccount) => Promise<GameService>;
    lobbyTopic: (player: PlayerAccount, gameId: string) => Promise<string>;
    /** Called a short while after a player's last connection closed, unless they reconnected. */
    onGone: (playerId: string) => void;
    goneAfterMs: number;
  },
) {
  const { db, config, clock, hub, presence } = deps;
  const rooms = createMapRooms(hub, deps.shared);
  const accounts = new WeakMap<object, PlayerAccount>();
  const connections = new Set<{ drained: () => Promise<unknown> }>();
  const goneTimers = new Set<ReturnType<typeof setTimeout>>();
  app.addHook('onClose', async () => {
    for (const timer of goneTimers) clearTimeout(timer);
    goneTimers.clear();
    await Promise.all([...connections].map((connection) => connection.drained()));
  });
  app.get(
    '/ws',
    {
      websocket: true,

      /** Browsers attach cookies to any WebSocket handshake, so the page origin must be checked here. */
      preValidation: async (request) => {
        if (request.headers.origin !== config.webOrigin) throw new HttpError(401, 'UNAUTHENTICATED');
        const player = await readSession(db, request.cookies[SESSION_COOKIE], clock());
        if (!player) throw new HttpError(401, 'UNAUTHENTICATED');
        accounts.set(request, player);
      },
    },
    (socket, request) => {
      const player = accounts.get(request)!;
      const client = hub.connect(player.id, (event) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
      });
      let lobby: string | undefined;
      let movedAt = 0;
      /** Commands of one connection run in order, so a move cannot overtake the enter before it. */
      let queue: Promise<unknown> = Promise.resolve();
      const connection = { drained: () => queue };
      connections.add(connection);

      async function handle(command: RealtimeCommand) {
        if (command.type === 'lobby.watch' || command.type === 'lobby.unwatch') {
          if (lobby) hub.unsubscribe(client, lobby);
          lobby = command.type === 'lobby.watch' ? await deps.lobbyTopic(player, command.gameId) : undefined;
          if (lobby) hub.subscribe(client, lobby);
        } else if (command.type === 'map.leave') {
          await rooms.leave(client);
          await presence.leave(player.id);
        } else if (command.type === 'map.enter') {
          const map = resolveMap(command.regionId, command.mapId);
          if (!map?.channels || command.x > map.width || command.y > map.height) return;
          const service = await deps.serviceFor(player);
          const channels = service.getMapChannels({ regionId: command.regionId, mapId: command.mapId });
          const self = service.getPlayer();
          const state = await withPlayerDocument(db, player.id, (document) => ({
            channelId: channels(document).currentChannelId,
            outfit: self(document).outfit,
          }));
          if (!(await presence.claim(player.id, map.id, state.channelId, map.channels.capacity, clock())))
            throw new ApiSdkError('CHANNEL_FULL');
          await rooms.enter(client, map.id, state.channelId, [map.width, map.height], {
            ...player,
            outfit: state.outfit,
            x: command.x,
            y: command.y,
          });
        } else {
          if (clock() - movedAt < MOVE_INTERVAL_MS) return;
          movedAt = clock();
          await rooms.move(client, command.x, command.y);
        }
      }

      socket.on('message', (data) => {
        let command: RealtimeCommand | undefined;
        try {
          command = decodeRealtimeCommand(JSON.parse(String(data)));
        } catch {}
        if (!command) return;

        queue = queue
          .then(async () => {
            await presence.touch(player.id, clock());
            await handle(command);
          })
          .catch((error) => request.log.error(error));
      });
      const connectionKey = `connection:${player.id}:${randomUUID()}`;
      void deps.shared.set(connectionKey, true, 45_000);
      let pong = true;
      socket.on('pong', () => {
        pong = true;
      });
      const heartbeat = setInterval(() => {
        if (!pong) {
          socket.terminate();
          return;
        }
        pong = false;
        socket.ping();
        queue = queue
          .then(async () => {
            await deps.shared.set(connectionKey, true, 45_000);
            await presence.touch(player.id, clock());
            await rooms.touch(client);
          })
          .catch((error) => request.log.error(error));
      }, 15_000);
      heartbeat.unref();
      socket.on('close', () => {
        clearInterval(heartbeat);
        hub.disconnect(client);
        queue = queue
          .then(async () => {
            await rooms.leave(client);
            await deps.shared.delete(connectionKey);
          })
          .catch((error) => request.log.error(error));
        void queue.finally(() => connections.delete(connection));
        const goneTimer = setTimeout(() => {
          goneTimers.delete(goneTimer);
          void queue
            .then(async () => {
              if (!(await deps.shared.entries(`connection:${player.id}:`)).length) deps.onGone(player.id);
            })
            .catch((error) => request.log.error(error));
        }, deps.goneAfterMs);
        goneTimer.unref();
        goneTimers.add(goneTimer);
      });
    },
  );
}
