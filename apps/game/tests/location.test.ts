import { MAPS } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { moveInLocation } from '@/features/location/_utils/location-logic';

it('keeps foot anchors in bounds', () => {
  expect(moveInLocation(MAPS[0], [10, 10], [-20, -20])).toEqual([8, 4]);
});
it('does not tunnel through obstacles and slides along their edge', () => {
  const map = { ...MAPS[0], obstacles: [{ x0: 100, y0: 50, x1: 130, y1: 150 }] };
  const [x, y] = moveInLocation(map, [80, 70], [100, 20]);
  expect(x).toBeLessThanOrEqual(92);
  expect(y).toBeCloseTo(90);
});
