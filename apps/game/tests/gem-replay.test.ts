import { gemFallRows } from '@chibi-town/arcade-games-react/gem-replay';
import { expect, it } from 'vitest';

it('moves surviving gems down the removed rows in their own column', () => {
  const rows = gemFallRows([40, 56]);
  expect(Array.from({ length: 8 }, (_, row) => rows[row * 8])).toEqual([2, 2, 2, 2, 2, 2, 2, 1]);
  expect(rows.filter((_, i) => i % 8 !== 0).every((distance) => distance === 0)).toBe(true);
});
it('spawns top-row replacements while leaving gems below them stationary', () => {
  const rows = gemFallRows([0, 8, 7]);
  expect(Array.from({ length: 8 }, (_, row) => rows[row * 8])).toEqual([2, 2, 0, 0, 0, 0, 0, 0]);
  expect(Array.from({ length: 8 }, (_, row) => rows[row * 8 + 7])).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
});
