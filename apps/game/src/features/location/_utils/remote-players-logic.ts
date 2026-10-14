import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import type { RealtimeEvent } from '@chibi-town/contracts/realtime';

export type RemotePlayer = {
  id: string;
  name: string;
  level: number;
  avatar: AvatarState;
  x: number;
  y: number;
  target: [number, number];
};
const WALK_SPEED = 100;
/** Further than this the walk would look like a chase, so the avatar is placed directly. */
const SNAP_DISTANCE = 320;

/** Other players in the same map channel, driven by server events and walked locally between position updates. */
export function createRemotePlayers(selfId: string) {
  const players = new Map<string, RemotePlayer>();

  function add(player: Extract<RealtimeEvent, { type: 'map.join' }>['player']) {
    if (player.id === selfId) return;
    players.set(player.id, {
      id: player.id,
      name: player.name,
      level: player.level,
      avatar: new AvatarState(toEquip(player.outfit)),
      x: player.x,
      y: player.y,
      target: [player.x, player.y],
    });
  }

  return {
    players,

    apply(event: RealtimeEvent) {
      if (event.type === 'map.state') {
        players.clear();
        event.players.forEach(add);
      } else if (event.type === 'map.join') add(event.player);
      else if (event.type === 'map.leave') players.delete(event.id);
      else if (event.type === 'map.move') {
        const player = players.get(event.id);
        if (player) player.target = [event.x, event.y];
      }
    },

    /** Advances animation frames; call on the scene's fixed step. */
    tick() {
      for (const player of players.values()) player.avatar.step();
    },

    step(seconds: number) {
      for (const player of players.values()) {
        const dx = player.target[0] - player.x,
          dy = player.target[1] - player.y,
          distance = Math.hypot(dx, dy);
        if (distance > SNAP_DISTANCE || distance < 1) {
          [player.x, player.y] = player.target;
          player.avatar.setAction(Action.Stand);
          continue;
        }
        const travel = Math.min(distance, WALK_SPEED * seconds);
        player.x += (dx / distance) * travel;
        player.y += (dy / distance) * travel;
        if (Math.abs(dx) > 0.5) player.avatar.mirror = dx < 0;
        player.avatar.setAction(Action.Walk);
      }
    },
  };
}
