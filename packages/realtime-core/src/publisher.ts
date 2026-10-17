import type { Bus, Event } from './ports.js';

export type RealtimeEnvelope = { data?: string; except?: string; close?: boolean };

export const playerTopic = (id: string) => `player:${id}`;

/** A publisher has no sockets, sessions, presence or domain dependencies. */
export function createRealtimePublisher(bus: Bus) {
  return {
    async publish<T extends Event>(topic: string, event: T, except?: string) {
      await bus.publish(topic, JSON.stringify({ data: JSON.stringify(event), except } satisfies RealtimeEnvelope));
    },

    async notifyPlayers<T extends Event>(ids: string[], event: T) {
      const envelope = JSON.stringify({ data: JSON.stringify(event) } satisfies RealtimeEnvelope);
      await Promise.all([...new Set(ids)].map((id) => bus.publish(playerTopic(id), envelope)));
    },
  };
}

export type RealtimePublisher = ReturnType<typeof createRealtimePublisher>;
