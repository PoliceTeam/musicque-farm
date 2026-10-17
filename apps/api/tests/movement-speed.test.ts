import { LOCATION_WALK_SPEED } from '@chibi-town/game-content/movement-config';
import { expect, it } from 'vitest';
import { acceptMovement, startMovement } from '@/modules/world/movement-policy';

it('accepts continuous movement at the configured client speed while rejecting teleports', () => {
  let state = startMovement(0, 0, 0);
  for (let tick = 1; tick <= 100; tick++) {
    const next = acceptMovement(state, (tick * LOCATION_WALK_SPEED) / 10, 0, tick * 100);
    expect(next).toBeDefined();
    state = next!;
  }
  expect(acceptMovement(state, state.x + 500, 0, state.at + 100)).toBeUndefined();
});
