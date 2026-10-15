import type { MapPlayer } from '@chibi-town/contracts/realtime';
import type { RealtimeService } from '@chibi-town/realtime-core';

type Move = { id: string; x: number; y: number; owner: string };
type Batch = {
  moves: Map<string, Move>;
  sending?: Map<string, Move>;
  timer?: ReturnType<typeof setTimeout>;
  flushing?: Promise<void>;
};

/** One in-flight flush and one latest-position batch per room, even when the bus/store is slow. */
export function createMoveBatches(realtime: RealtimeService, onError: (error: unknown) => void) {
  const batches = new Map<string, Batch>();
  let stopped = false;

  function schedule(topic: string, batch: Batch) {
    batch.timer = setTimeout(() => {
      batch.timer = undefined;
      const moves = batch.moves;
      batch.sending = moves;
      batch.moves = new Map();
      batch.flushing = realtime.rooms
        .takeChanges<{ player: MapPlayer }>(topic, 100)
        .then(async (members) => {
          if (!members) {
            // Another instance already emitted this room's tick. Keep only the latest local position pending.
            for (const [id, move] of moves) if (!batch.moves.has(id)) batch.moves.set(id, move);
            return;
          }
          const live = Object.entries(members)
            .filter(([, member]) => member.player)
            .map(([id, member]) => ({
              id,
              x: member.player.player.x,
              y: member.player.player.y,
              owner: member.owner,
            }));
          if (live.length)
            await realtime.publish(
              topic,
              { type: 'map.moves', moves: live.map(({ id, x, y }) => ({ id, x, y })) },
              live.length === 1 ? live[0].owner : undefined,
            );
        })
        .catch(onError)
        .finally(() => {
          batch.flushing = undefined;
          batch.sending = undefined;
          if (!stopped && batch.moves.size) schedule(topic, batch);
          else batches.delete(topic);
        });
    }, 100);
    batch.timer.unref();
  }

  return {
    add(topic: string, move: Move) {
      if (stopped) return;
      let batch = batches.get(topic);
      if (!batch) {
        batch = { moves: new Map() };
        batches.set(topic, batch);
        schedule(topic, batch);
      }
      batch.moves.set(move.id, move);
    },

    discard(id: string, owner?: string) {
      for (const batch of batches.values()) {
        for (const moves of [batch.moves, batch.sending]) {
          if (moves && (!owner || moves.get(id)?.owner === owner)) moves.delete(id);
        }
      }
    },

    async close() {
      stopped = true;
      for (const batch of batches.values()) if (batch.timer) clearTimeout(batch.timer);
      await Promise.all([...batches.values()].map((batch) => batch.flushing));
      batches.clear();
    },
  };
}
