import { PLAYER_WALK_SPEED } from '@chibi-town/game-content/movement-config';
import { ENTRANCE_WALK_BOUNDS } from '@/features/farm-entrance/_utils/entrance-layout';

export type EntranceWalk = { x: number; y: number; target?: [number, number] };

export function stepEntranceWalk(
  state: EntranceWalk,
  direction: readonly [number, number],
  seconds: number,
  blocked: boolean,
) {
  if (blocked) return { moving: false, dx: 0 };
  let [dx, dy] = direction;
  if (dx || dy) state.target = undefined;
  else if (state.target) {
    dx = state.target[0] - state.x;
    dy = state.target[1] - state.y;
    if (Math.hypot(dx, dy) < 2) {
      state.target = undefined;
      return { moving: false, dx: 0 };
    }
  }
  const distance = Math.hypot(dx, dy);
  if (!distance) return { moving: false, dx: 0 };
  const step = Math.min(state.target ? distance : Infinity, seconds * PLAYER_WALK_SPEED);
  const beforeX = state.x,
    beforeY = state.y;
  const bounds = ENTRANCE_WALK_BOUNDS;
  state.x = Math.max(bounds.left, Math.min(bounds.right, state.x + (dx / distance) * step));
  state.y = Math.max(bounds.top, Math.min(bounds.bottom, state.y + (dy / distance) * step));
  return { moving: state.x !== beforeX || state.y !== beforeY, dx: state.x - beforeX };
}
