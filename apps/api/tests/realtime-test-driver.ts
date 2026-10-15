import { randomUUID } from 'node:crypto';
import type { RealtimeEvent } from '@chibi-town/contracts/realtime';
import { type Adapters, type Connection, createRealtimeService } from '@chibi-town/realtime-core';

/** A transport driver for testing world handlers independently of Fastify/WebSocket. */
export function createRealtimeDriver(adapters: Adapters, clock = Date.now) {
  let accept!: (connection: Connection) => void;
  const realtime = createRealtimeService({
    ...adapters,
    clock,
    transport: {
      accept(listener) {
        accept = listener;
        return () => {};
      },
    },

    decode: () => undefined,

    validateSession: async () => Number.MAX_SAFE_INTEGER,

    onError(error) {
      throw error;
    },
  });
  return {
    realtime,

    connect(playerId: string, send: (event: RealtimeEvent) => void) {
      let closed = false;

      let close = () => {};

      const connection: Connection = {
        id: randomUUID(),
        identity: { playerId, sessionId: playerId, expiresAt: Number.MAX_SAFE_INTEGER, context: null },
        bufferedAmount: 0,

        send: (raw) => send(JSON.parse(raw)),

        close() {
          if (!closed) {
            closed = true;
            close();
          }
        },

        terminate() {
          connection.close(1006);
        },

        ping() {},

        onMessage() {},

        onPong() {},

        onClose(listener) {
          close = listener;
        },
      };
      accept(connection);
      return connection;
    },
  };
}
