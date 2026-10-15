/** Native pixels per second, with a bounded bank for network jitter (client walks at 100 px/s). */
const SPEED = 120;
const DISTANCE_BANK = 40;
export type MovementState = { x: number; y: number; at: number; credit: number };

export function startMovement(x: number, y: number, now: number): MovementState {
  return { x, y, at: now, credit: DISTANCE_BANK };
}

export function acceptMovement(previous: MovementState, x: number, y: number, now: number): MovementState | undefined {
  if (![x, y, now].every(Number.isFinite) || x < 0 || y < 0) return undefined;
  const at = Math.max(previous.at, now);
  const available = Math.min(DISTANCE_BANK, previous.credit + ((at - previous.at) * SPEED) / 1000);
  const distance = Math.hypot(x - previous.x, y - previous.y);
  return distance <= available ? { x, y, at, credit: available - distance } : undefined;
}
