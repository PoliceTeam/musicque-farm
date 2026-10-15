import { randomUUID } from 'node:crypto';
import { ApiSdkError } from '@chibi-town/contracts';
import { decodeRealtimeCommand, type RealtimeCommand } from '@chibi-town/contracts/realtime';
import { resolveMap } from '@chibi-town/game-content';
import type { FastifyInstance } from 'fastify';
import { HttpError } from '@/_utils/http-errors';
import {
  hashSessionToken,
  type PlayerAccount,
  readSessionState,
  SESSION_COOKIE,
  type SessionState,
} from '@/_utils/session-auth';
import {
  backpressureCloseCode,
  CONNECTION_CLOSE,
  CONNECTION_POLICY,
  type ConnectionWork,
  consumeRate,
  heartbeatAction,
  queueConnectionWork,
  type RateBudget,
  sessionCheckDue,
} from '@/application/_utils/connection-policy';
import type { ApiConfig } from '@/config';
import type { Database } from '@/infrastructure/database/database';
import type { RealtimeHub } from '@/infrastructure/realtime/realtime-hub';
import type { SharedState } from '@/infrastructure/realtime/shared-state';
import type { ChannelPresence, WorldService } from '@/modules/world';
import { createMapRooms } from '@/modules/world';

export function registerRealtimeRoutes(
  app: FastifyInstance,
  deps: {
    shared: SharedState;
    db: Database;
    config: ApiConfig;
    clock: () => number;
    hub: RealtimeHub;
    presence: ChannelPresence;
    world: WorldService;
    lobbyTopic: (player: PlayerAccount, gameId: string) => Promise<string>;
    /** Called a short while after a player's last connection closed, unless they reconnected. */
    onGone: (playerId: string) => void;
    goneAfterMs: number;
  },
) {
  const { db, config, clock, hub, presence } = deps;
  const rooms = createMapRooms(hub, deps.shared, clock);
  const accounts = new WeakMap<object, SessionState>();
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
        const session = await readSessionState(db, request.cookies[SESSION_COOKIE], clock());
        if (!session) throw new HttpError(401, 'UNAUTHENTICATED');
        accounts.set(request, session);
      },
    },
    (socket, request) => {
      const handshake = accounts.get(request)!;
      const player = handshake.player;
      let sessionExpiresAt = handshake.expiresAt;
      let sessionCheckedAt = clock();
      let active = true;
      let waiting: ConnectionWork<() => Promise<void>>[] = [];
      let running = false;
      let runningCommand = false;
      let generalBudget: RateBudget | undefined;
      let expensiveBudget: RateBudget | undefined;
      let movedAt = Number.NEGATIVE_INFINITY;
      let lobby: string | undefined;
      let queue: Promise<unknown> = Promise.resolve();
      const connection = { drained: () => queue };
      connections.add(connection);

      function close(code: number) {
        if (!active) return;
        active = false;
        socket.close(code);
      }

      const client = hub.connect(
        player.id,
        (event) => {
          if (!active || socket.readyState !== socket.OPEN) return;
          const code = backpressureCloseCode(socket.bufferedAmount);
          if (code) close(code);
          else {
            socket.send(JSON.stringify(event));
            const afterSend = backpressureCloseCode(socket.bufferedAmount);
            if (afterSend) close(afterSend);
          }
        },
        {
          sessionId: hashSessionToken(request.cookies[SESSION_COOKIE]!),

          close: () => close(CONNECTION_CLOSE.session),
        },
      );

      /** The queue holds real work, rather than an unbounded chain of obsolete move placeholders. */
      function enqueue(task: () => Promise<void>, kind: ConnectionWork<unknown>['kind'] = 'command') {
        if (!active) return;
        const next = queueConnectionWork(waiting, { kind, value: task }, runningCommand);
        if (next.closeCode) return close(next.closeCode);
        waiting = next.waiting;
        if (running) return;
        running = true;
        queue = Promise.resolve().then(async () => {
          try {
            while (waiting.length) {
              const work = waiting.shift()!;
              runningCommand = work.kind === 'command';
              try {
                if (active) await work.value();
              } catch (error) {
                request.log.error(error);
              } finally {
                runningCommand = false;
              }
            }
          } finally {
            running = false;
          }
        });
      }

      async function handle(command: RealtimeCommand) {
        if (command.type === 'lobby.watch' || command.type === 'lobby.unwatch') {
          if (lobby) hub.unsubscribe(client, lobby);
          lobby = command.type === 'lobby.watch' ? await deps.lobbyTopic(player, command.gameId) : undefined;
          if (lobby && active) hub.subscribe(client, lobby);
        } else if (command.type === 'map.leave') {
          await rooms.leave(client);
          await presence.leave(player.id);
        } else if (command.type === 'map.enter') {
          const map = resolveMap(command.regionId, command.mapId);
          if (!map?.channels || command.x > map.width || command.y > map.height) return;
          const state = await deps.world.getMapState(player, { regionId: command.regionId, mapId: command.mapId });
          if (!(await presence.claim(player.id, map.id, state.channelId, map.channels.capacity, clock())))
            throw new ApiSdkError('CHANNEL_FULL');
          await rooms.enter(client, map.id, state.channelId, [map.width, map.height], {
            ...player,
            outfit: state.outfit,
            x: command.x,
            y: command.y,
          });
        } else {
          await rooms.move(client, command.x, command.y);
        }
      }

      socket.on('message', (data) => {
        if (!active) return;
        // Charge even malformed messages, before parsing or touching shared state.
        const now = clock();
        const general = consumeRate(generalBudget, now, CONNECTION_POLICY.messagesPerSecond, CONNECTION_POLICY.burst);
        generalBudget = general.budget;
        if (!general.allowed) return;
        let command: RealtimeCommand | undefined;
        try {
          command = decodeRealtimeCommand(JSON.parse(String(data)));
        } catch {}
        if (!command) return;
        if (command.type === 'map.enter' || command.type === 'lobby.watch') {
          const expensive = consumeRate(
            expensiveBudget,
            now,
            CONNECTION_POLICY.expensivePerSecond,
            CONNECTION_POLICY.expensiveBurst,
          );
          expensiveBudget = expensive.budget;
          if (!expensive.allowed) return;
        }
        if (command.type === 'map.move') {
          if (now - movedAt < CONNECTION_POLICY.moveIntervalMs) return;
          movedAt = now;
        }
        const accepted = command;
        enqueue(() => handle(accepted), accepted.type === 'map.move' ? 'move' : 'command');
      });
      const connectionKey = `connection:${player.id}:${randomUUID()}`;
      enqueue(() => deps.shared.set(connectionKey, true, CONNECTION_POLICY.leaseMs), 'maintenance');
      let pong = true;
      let heartbeatPending = false;
      socket.on('pong', () => {
        pong = true;
      });
      const heartbeat = setInterval(() => {
        if (!active) return;
        const action = heartbeatAction(pong, clock() < sessionExpiresAt, socket.bufferedAmount);
        if (action === 'session') return close(CONNECTION_CLOSE.session);
        if (action === 'slow') return close(CONNECTION_CLOSE.slow);
        if (action === 'terminate') {
          active = false;
          socket.terminate();
          return;
        }
        pong = false;
        socket.ping();
        if (heartbeatPending) return;
        heartbeatPending = true;
        enqueue(async () => {
          try {
            if (sessionCheckDue(sessionCheckedAt, clock())) {
              const checkedAt = clock();
              const session = await readSessionState(db, request.cookies[SESSION_COOKIE], checkedAt);
              if (session?.player.id !== player.id) return close(CONNECTION_CLOSE.session);
              sessionExpiresAt = session.expiresAt;
              sessionCheckedAt = checkedAt;
            }
            const checked = heartbeatAction(true, clock() < sessionExpiresAt, socket.bufferedAmount);
            if (checked === 'session') return close(CONNECTION_CLOSE.session);
            if (checked === 'slow') return close(CONNECTION_CLOSE.slow);
            if (!active) return;
            await deps.shared.set(connectionKey, true, CONNECTION_POLICY.leaseMs);
            await presence.touch(player.id, clock());
            await rooms.touch(client);
          } finally {
            heartbeatPending = false;
          }
        }, 'maintenance');
      }, CONNECTION_POLICY.heartbeatMs);
      heartbeat.unref();
      socket.on('close', () => {
        active = false;
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
