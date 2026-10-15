import '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import type { Connection, Identity, Transport } from '@chibi-town/realtime-core';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Origin/cookie/session policy belongs to the composition callback, never to the transport. */
export async function createFastifyWsTransport(
  app: FastifyInstance,
  options: {
    path: string;
    authenticate(request: FastifyRequest): Promise<Identity>;
  },
): Promise<Transport> {
  await app.register(websocket, { options: { maxPayload: 4096 } });
  const identities = new WeakMap<object, Identity>();
  let accept: ((connection: Connection) => void) | undefined;
  app.get(
    options.path,
    {
      websocket: true,

      preValidation: async (request) => {
        identities.set(request, await options.authenticate(request));
      },
    },
    (socket, request) => {
      const identity = identities.get(request)!;
      const connection: Connection = {
        id: randomUUID(),
        identity,

        get bufferedAmount() {
          return socket.bufferedAmount;
        },

        send(raw) {
          if (socket.readyState === socket.OPEN) socket.send(raw);
        },

        close(code) {
          socket.close(code);
        },

        terminate() {
          socket.terminate();
        },

        ping() {
          socket.ping();
        },

        onMessage(listener) {
          socket.on('message', (raw) => listener(String(raw)));
        },

        onPong(listener) {
          socket.on('pong', listener);
        },

        onClose(listener) {
          socket.on('close', listener);
        },
      };
      if (accept) accept(connection);
      else connection.close(1013);
    },
  );
  return {
    accept(listener) {
      accept = listener;
      return () => {
        accept = undefined;
      };
    },
  };
}
