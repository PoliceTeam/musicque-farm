// Someone walking around the map: the player (keyboard / click-to-move) or a wandering NPC.
import { Action, type AvatarState } from '@chibi-town/character-core/animation-logic';

export type Area = { x0: number; x1: number; y0: number; y1: number };

export type Walker = {
  name: string;
  level: number;
  x: number;
  y: number;
  speed: number; // native pixels per second
  target: [number, number] | null;
  wait: number; // seconds an NPC idles before picking a new spot
  avatar: AvatarState;
  player?: boolean;
};

export function clampTo(area: Area, x: number, y: number): [number, number] {
  return [Math.min(area.x1, Math.max(area.x0, x)), Math.min(area.y1, Math.max(area.y0, y))];
}

/**
 * Move one walker for `dt` seconds. `direction` is held-key input (players only); it overrides
 * a click target. Returns true when the walker reached its target this step.
 */
export function stepWalker(
  w: Walker,
  dt: number,
  area: Area,
  direction: [number, number] = [0, 0],
  random: () => number = Math.random,
): boolean {
  let [vx, vy] = [0, 0];
  let arrived = false;
  if (w.player && (direction[0] || direction[1])) {
    w.target = null;
    [vx, vy] = direction;
  } else if (w.target) {
    const dx = w.target[0] - w.x;
    const dy = w.target[1] - w.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= w.speed * dt || distance < 0.5) {
      [w.x, w.y] = w.target;
      w.target = null;
      arrived = true;
      if (!w.player) w.wait = 1 + random() * 3;
    } else {
      vx = dx / distance;
      vy = dy / distance;
    }
  } else if (!w.player) {
    w.wait -= dt;
    if (w.wait <= 0) w.target = clampTo(area, w.x + (random() - 0.5) * 140, w.y + (random() - 0.5) * 60);
  }

  const length = Math.hypot(vx, vy);
  if (length === 0) {
    w.avatar.setAction(Action.Stand);
    return arrived;
  }
  vx /= length;
  vy /= length;
  [w.x, w.y] = clampTo(area, w.x + vx * w.speed * dt, w.y + vy * w.speed * dt);
  // As in hn.g and the left/right key handlers: only horizontal movement changes the facing.
  if (Math.abs(vx) > 0.2) w.avatar.mirror = vx < 0;
  w.avatar.setAction(Action.Walk);
  return arrived;
}
