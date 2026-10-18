import { describe, expect, it } from 'vitest';
import {
  ENTRANCE_FENCE_SEGMENTS,
  ENTRANCE_FENCE_Y,
  ENTRANCE_LAWNS,
  ENTRANCE_SIZE,
  ENTRANCE_TARGETS,
  ENTRANCE_WALK_BOUNDS,
  entranceActionAt,
} from '@/features/farm-entrance/_utils/entrance-layout';
import { type EntranceWalk, stepEntranceWalk } from '@/features/farm-entrance/_utils/entrance-walk-logic';

describe('farm entrance reference interactions', () => {
  it('keeps the friends fence opening distinct from the shop door and home gate', () => {
    expect(entranceActionAt(165, 457)).toBe('friends');
    expect(entranceActionAt(1185, 520)).toBeUndefined();
    expect(entranceActionAt(700, 494)).toBe('shop');
    expect(entranceActionAt(325, 494)).toBe('home');
    for (const target of ENTRANCE_TARGETS) {
      if (target.arrow) expect(entranceActionAt(target.arrow[0], target.arrow[1])).toBe(target.action);
    }
    expect(entranceActionAt(525, 535)).toBeUndefined();
  });
  it('uses the main farm world proportions without stretching either axis', () => {
    expect(ENTRANCE_SIZE).toEqual({ width: 1280, height: 720 });
    for (const target of ENTRANCE_TARGETS) {
      expect(target.x + target.width).toBeLessThanOrEqual(ENTRANCE_SIZE.width);
      expect(target.y + target.height).toBeLessThanOrEqual(ENTRANCE_SIZE.height);
    }
  });
  it('keeps movement on the new road and stops the animation against its boundary', () => {
    const state: EntranceWalk = { x: ENTRANCE_WALK_BOUNDS.right, y: ENTRANCE_WALK_BOUNDS.bottom };
    expect(stepEntranceWalk(state, [1, 1], 0.05, false)).toEqual({ moving: false, dx: 0 });
    expect(state.y).toBe(ENTRANCE_WALK_BOUNDS.bottom);
    expect(stepEntranceWalk(state, [-1, -1], 0.05, false).moving).toBe(true);
    expect(state.y).toBeGreaterThanOrEqual(ENTRANCE_WALK_BOUNDS.top);
  });
  it('stops input while a dialog is open and preserves a target without moving behind it', () => {
    const state: EntranceWalk = { x: 525, y: 535, target: [1000, 555] };
    expect(stepEntranceWalk(state, [1, 0], 1, true).moving).toBe(false);
    expect(state).toEqual({ x: 525, y: 535, target: [1000, 555] });
    expect(stepEntranceWalk(state, [0, 0], 0.05, false).moving).toBe(true);
    expect(state.x).toBeGreaterThan(525);
  });
});

it('leaves unobstructed friends, gate and shop approaches and a continuous foreground verge', () => {
  for (const action of ['friends', 'home', 'shop']) {
    const target = ENTRANCE_TARGETS.find((target) => target.action === action)!;
    const x = target.arrow![0];
    expect(ENTRANCE_FENCE_SEGMENTS.some(([start, end]) => x > start && x < end)).toBe(false);
    expect(
      ENTRANCE_LAWNS.some(
        ([left, top, width, height]) =>
          x > left && x < left + width && ENTRANCE_FENCE_Y > top && ENTRANCE_FENCE_Y < top + height,
      ),
    ).toBe(false);
  }
  expect(
    ENTRANCE_LAWNS.some(
      ([x, y, width, height]) => x <= 0 && x + width >= 1280 && y > ENTRANCE_WALK_BOUNDS.bottom && y + height >= 720,
    ),
  ).toBe(true);
});
