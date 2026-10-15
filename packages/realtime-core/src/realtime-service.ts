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
} from './_utils/connection-policy.js';
import type { Bus, Connection, Coordination, Event, Store, Transport } from './ports.js';
import { createPresenceService } from './presence.js';
import { createRoomService } from './rooms.js';

type Handler = { run(connection: Connection, command: Event): Promise<void>; expensive?: boolean; coalesce?: boolean };
type Envelope = { data?: string; except?: string; close?: boolean };

export function createRealtimeService(deps: {
  transport: Transport;
  bus: Bus;
  store: Store;
  coordination: Coordination;
  clock: () => number;
  decode(raw: string): Event | undefined;
  validateSession(connection: Connection): Promise<number | undefined>;
  onError(error: unknown): void;
  onGone?(playerId: string): void;
  goneAfterMs?: number;
}) {
  const { bus, store, clock } = deps;
  let shuttingDown = false;
  const rooms = createRoomService(
    store,
    deps.coordination,
    clock,
    (connection) => leaseDeadlines.get(connection.id) ?? clock(),
  );
  const presence = createPresenceService(store, deps.coordination, clock);
  const handlers = new Map<string, Handler>();
  const clients = new Map<string, Connection>();
  const memberships = new Map<string, Set<string>>();
  const topics = new Map<string, { clients: Set<Connection>; stop: Promise<() => Promise<void>> }>();
  const closing = new Map<string, { connection: Connection; done: Promise<void> }>();
  const disconnectHandlers = new Set<(connection: Connection) => Promise<void>>();
  const heartbeatHandlers = new Set<(connection: Connection) => Promise<void>>();
  const shutdownHandlers = new Set<() => void | Promise<void>>();
  const leaseDeadlines = new Map<string, number>();
  const goneTimers = new Set<ReturnType<typeof setTimeout>>();

  const playerTopic = (id: string) => `player:${id}`;

  const sessionTopic = (id: string) => `session:${id}`;

  function send(connection: Connection, data: string) {
    if (!clients.has(connection.id)) return;
    const before = backpressureCloseCode(connection.bufferedAmount);
    if (before) return connection.close(before);
    connection.send(data);
    const after = backpressureCloseCode(connection.bufferedAmount);
    if (after) connection.close(after);
  }

  async function subscribe(connection: Connection, topic: string) {
    let entry = topics.get(topic);
    if (!entry) {
      const receivers = new Set<Connection>();
      entry = {
        clients: receivers,
        stop: bus.subscribe(topic, (raw) => {
          const envelope = JSON.parse(raw) as Envelope;
          for (const client of receivers) {
            if (envelope.except === client.id) continue;
            if (envelope.close) client.close(CONNECTION_CLOSE.session);
            else if (envelope.data) send(client, envelope.data);
          }
        }),
      };
      topics.set(topic, entry);
    }
    entry.clients.add(connection);
    if (!memberships.has(connection.id)) memberships.set(connection.id, new Set());
    memberships.get(connection.id)!.add(topic);
    try {
      await entry.stop;
    } catch (error) {
      await unsubscribe(connection, topic);
      throw error;
    }
  }

  async function unsubscribe(connection: Connection, topic: string) {
    const entry = topics.get(topic);
    memberships.get(connection.id)?.delete(topic);
    entry?.clients.delete(connection);
    if (entry && !entry.clients.size) {
      topics.delete(topic);
      await entry.stop.then(
        (stop) => stop(),
        () => {},
      );
    }
  }

  async function publish<T extends Event>(topic: string, event: T, except?: string) {
    await bus.publish(topic, JSON.stringify({ data: JSON.stringify(event), except } satisfies Envelope));
  }

  const detach = deps.transport.accept((connection) => {
    let resolveClosed!: () => void;
    closing.set(connection.id, {
      connection,
      done: new Promise<void>((resolve) => {
        resolveClosed = resolve;
      }),
    });
    clients.set(connection.id, connection);
    leaseDeadlines.set(connection.id, clock() + CONNECTION_POLICY.leaseMs);
    let active = true;
    let waiting: ConnectionWork<() => Promise<void>>[] = [];
    let running = false;
    let runningCommand = false;
    let queue: Promise<unknown> = Promise.resolve();
    let generalBudget: RateBudget | undefined;
    let expensiveBudget: RateBudget | undefined;
    let movedAt = Number.NEGATIVE_INFINITY;
    let expiresAt = connection.identity.expiresAt;
    let checkedAt = clock();

    function close(code: number) {
      if (!active) return;
      active = false;
      clients.delete(connection.id);
      connection.close(code);
    }

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
              deps.onError(error);
            } finally {
              runningCommand = false;
            }
          }
        } finally {
          running = false;
        }
      });
    }

    connection.onMessage((raw) => {
      if (!active) return;
      const now = clock();
      const general = consumeRate(generalBudget, now, CONNECTION_POLICY.messagesPerSecond, CONNECTION_POLICY.burst);
      generalBudget = general.budget;
      if (!general.allowed) return;
      let command: Event | undefined;
      try {
        command = deps.decode(raw);
      } catch {}
      if (!command) return;
      const handler = handlers.get(command.type);
      if (!handler) return;
      if (handler.expensive) {
        const expensive = consumeRate(
          expensiveBudget,
          now,
          CONNECTION_POLICY.expensivePerSecond,
          CONNECTION_POLICY.expensiveBurst,
        );
        expensiveBudget = expensive.budget;
        if (!expensive.allowed) return;
      }
      if (handler.coalesce) {
        if (now - movedAt < CONNECTION_POLICY.moveIntervalMs) return;
        movedAt = now;
      }
      const accepted = command;
      enqueue(() => handler.run(connection, accepted), handler.coalesce ? 'move' : 'command');
    });
    enqueue(async () => {
      await subscribe(connection, playerTopic(connection.identity.playerId));
      await subscribe(connection, sessionTopic(connection.identity.sessionId));
      // A logout may publish between authentication and an asynchronous bus subscription.
      // Recheck after subscribing; subsequent revocations now arrive through the live topic.
      const expiry = await deps.validateSession(connection);
      if (expiry === undefined) return close(CONNECTION_CLOSE.session);
      expiresAt = expiry;
      checkedAt = clock();
      if (active) await store.lease(connection.identity.playerId, connection.id, leaseDeadlines.get(connection.id)!);
    }, 'maintenance');
    let pong = true;
    let heartbeatPending = false;
    connection.onPong(() => {
      pong = true;
    });
    const heartbeat = setInterval(() => {
      if (!active) return;
      const action = heartbeatAction(pong, clock() < expiresAt, connection.bufferedAmount);
      if (action === 'session') return close(CONNECTION_CLOSE.session);
      if (action === 'slow') return close(CONNECTION_CLOSE.slow);
      if (action === 'terminate') {
        active = false;
        clients.delete(connection.id);
        connection.terminate();
        return;
      }
      pong = false;
      connection.ping();
      if (heartbeatPending) return;
      heartbeatPending = true;
      enqueue(async () => {
        try {
          if (sessionCheckDue(checkedAt, clock())) {
            const at = clock();
            const expiry = await deps.validateSession(connection);
            if (expiry === undefined) return close(CONNECTION_CLOSE.session);
            expiresAt = expiry;
            checkedAt = at;
          }
          if (clock() >= expiresAt) return close(CONNECTION_CLOSE.session);
          if (!active) return;
          const until = clock() + CONNECTION_POLICY.leaseMs;
          leaseDeadlines.set(connection.id, until);
          await store.lease(connection.identity.playerId, connection.id, until);
          await rooms.touch(connection, until);
          for (const handler of heartbeatHandlers) await handler(connection);
        } finally {
          heartbeatPending = false;
        }
      }, 'maintenance');
    }, CONNECTION_POLICY.heartbeatMs);
    unref(heartbeat);
    connection.onClose(() => {
      active = false;
      clients.delete(connection.id);
      clearInterval(heartbeat);
      waiting = [];
      queue = queue
        .then(async () => {
          try {
            for (const handler of disconnectHandlers) await handler(connection);
          } finally {
            await Promise.all(
              [...(memberships.get(connection.id) ?? [])].map((topic) => unsubscribe(connection, topic)),
            );
            memberships.delete(connection.id);
            leaseDeadlines.delete(connection.id);
            await store.release(connection.identity.playerId, connection.id);
          }
        })
        .catch(deps.onError);
      void queue.finally(() => {
        closing.delete(connection.id);
        resolveClosed();
      });
      if (shuttingDown) return;
      const goneTimer = setTimeout(() => {
        goneTimers.delete(goneTimer);
        void queue
          .then(async () => {
            if (!(await store.connected(connection.identity.playerId, clock())))
              deps.onGone?.(connection.identity.playerId);
          })
          .catch(deps.onError);
      }, deps.goneAfterMs ?? 20_000);
      unref(goneTimer);
      goneTimers.add(goneTimer);
    });
  });

  return {
    rooms,
    presence,
    publish,
    subscribe,
    unsubscribe,

    send: <T extends Event>(connection: Connection, event: T) => send(connection, JSON.stringify(event)),

    handle<T extends Event>(
      type: T['type'],
      handler: (connection: Connection, command: T) => Promise<void>,
      policy: Omit<Handler, 'run'> = {},
    ) {
      handlers.set(type, { ...policy, run: handler as Handler['run'] });
    },

    onShutdown(handler: () => void | Promise<void>) {
      shutdownHandlers.add(handler);
    },

    onDisconnect(handler: (connection: Connection) => Promise<void>) {
      disconnectHandlers.add(handler);
    },

    onHeartbeat(handler: (connection: Connection) => Promise<void>) {
      heartbeatHandlers.add(handler);
    },

    async notifyPlayers<T extends Event>(ids: string[], event: T) {
      const envelope = JSON.stringify({ data: JSON.stringify(event) } satisfies Envelope);
      await Promise.all([...new Set(ids)].map((id) => bus.publish(playerTopic(id), envelope)));
    },

    async revokeSession(id: string) {
      await bus.publish(sessionTopic(id), JSON.stringify({ close: true } satisfies Envelope));
    },

    async close() {
      shuttingDown = true;
      detach();
      for (const timer of goneTimers) clearTimeout(timer);
      goneTimers.clear();
      // Shutdown must also stop sockets already waiting for a peer's close handshake.
      const pending = [...closing.values()];
      for (const { connection } of pending) connection.terminate();
      await Promise.all(pending.map(({ done }) => done));
      for (const handler of shutdownHandlers) await handler();
      for (const entry of topics.values()) await (await entry.stop)();
      topics.clear();
    },
  };
}

function unref(timer: unknown) {
  (timer as { unref?: () => void }).unref?.();
}

export type RealtimeService = ReturnType<typeof createRealtimeService>;
