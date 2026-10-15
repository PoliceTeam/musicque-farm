import { randomUUID } from 'node:crypto';
import type { RealtimeEvent } from '@chibi-town/contracts/realtime';
import type { SharedState } from '@/infrastructure/realtime/shared-state';

export type RealtimeClient = {
  playerId: string;
  send: (event: RealtimeEvent) => void;
  topics: Set<string>;
  sessionId?: string;
  close?: () => void;
};

/** In-memory fan-out for one process. Topics are chosen by the server, never taken verbatim from a client. */
export function createRealtimeHub(shared?: SharedState) {
  const origin = randomUUID();
  type Envelope = {
    origin: string;
    topic?: string;
    playerIds?: string[];
    event?: RealtimeEvent;
    revokedSession?: string;
  };
  const unsubscribe = shared?.subscribe((message) => {
    const envelope = JSON.parse(message) as Envelope;
    if (envelope.origin === origin) return;
    if (envelope.topic && envelope.event) deliver(envelope.topic, envelope.event);
    if (envelope.playerIds && envelope.event) deliverPlayers(envelope.playerIds, envelope.event);
    if (envelope.revokedSession) closeSession(envelope.revokedSession);
  });

  const fanout = (envelope: Omit<Envelope, 'origin'>) => {
    void shared
      ?.publish(JSON.stringify({ ...envelope, origin }))
      .catch((error) => console.error('Realtime fan-out:', error));
  };

  const topics = new Map<string, Set<RealtimeClient>>();
  const players = new Map<string, Set<RealtimeClient>>();

  function deliver(topic: string, event: RealtimeEvent, except?: RealtimeClient) {
    for (const client of topics.get(topic) ?? []) if (client !== except) client.send(event);
  }

  function deliverPlayers(playerIds: Iterable<string>, event: RealtimeEvent) {
    for (const playerId of new Set(playerIds)) for (const client of players.get(playerId) ?? []) client.send(event);
  }

  function closeSession(sessionId: string) {
    for (const clients of players.values())
      for (const client of clients) if (client.sessionId === sessionId) client.close?.();
  }

  const hub = {
    async revokeSession(sessionId: string) {
      closeSession(sessionId);
      await shared?.publish(JSON.stringify({ origin, revokedSession: sessionId }));
    },

    close() {
      unsubscribe?.();
    },

    connect(
      playerId: string,
      send: RealtimeClient['send'],
      lifecycle?: Pick<RealtimeClient, 'sessionId' | 'close'>,
    ): RealtimeClient {
      const client = { playerId, send, topics: new Set<string>(), ...lifecycle };
      if (!players.has(playerId)) players.set(playerId, new Set());
      players.get(playerId)!.add(client);
      return client;
    },

    disconnect(client: RealtimeClient) {
      for (const topic of [...client.topics]) hub.unsubscribe(client, topic);
      const sockets = players.get(client.playerId);
      sockets?.delete(client);
      if (!sockets?.size) players.delete(client.playerId);
    },

    connected: (playerId: string) => players.has(playerId),

    subscribe(client: RealtimeClient, topic: string) {
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic)!.add(client);
      client.topics.add(topic);
    },

    unsubscribe(client: RealtimeClient, topic: string) {
      const members = topics.get(topic);
      members?.delete(client);
      if (!members?.size) topics.delete(topic);
      client.topics.delete(topic);
    },

    publish(topic: string, event: RealtimeEvent, except?: RealtimeClient) {
      deliver(topic, event, except);
      fanout({ topic, event });
    },

    /** Every open tab of each listed player. */
    publishToPlayers(playerIds: Iterable<string>, event: RealtimeEvent) {
      const ids = [...new Set(playerIds)];
      deliverPlayers(ids, event);
      fanout({ playerIds: ids, event });
    },
  };
  return hub;
}

export type RealtimeHub = ReturnType<typeof createRealtimeHub>;
