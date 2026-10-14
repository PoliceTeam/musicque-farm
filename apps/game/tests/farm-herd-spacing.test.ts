import { expect, it } from 'vitest';
import { FARM_ANIMALS, farmRoamPose, separateFarmHerd } from '@/features/farm/_utils/farm-animal-logic';
import { farmUnitArea } from '@/features/farm/_utils/farm-map-data';

it('spaces a moving adult herd and feeding groups without pushing bodies through the enclosure', () => {
  for (const level of [0, 1, 2] as const) {
    const a = farmUnitArea('livestock', level),
      safe = { x0: a.x0 + 34, x1: a.x1 - 34, y0: a.y0 + 125, y1: a.y1 - 53 };
    for (let t = -1200; t < 30000; t += 1200) {
      const points = FARM_ANIMALS.map((species, i) => {
        const p =
          t < 0
            ? {
                x: Math.max(safe.x0, Math.min(safe.x1, a.x0 + (a.x1 - a.x0) * 0.59 + ((i % 4) - 1.5) * 38)),
                y: a.y0 + 145 + Math.floor(i / 4) * 32,
              }
            : farmRoamPose(safe, i, t);
        const width = species === 'cow' ? 43 : ['hen', 'duck'].includes(species) ? 23 : 35;
        return { ...p, radiusX: width / 2 + 2, radiusY: 11 };
      });
      const spaced = separateFarmHerd(points, safe);
      for (const p of spaced) {
        expect(p.x - 26).toBeGreaterThan(a.x0);
        expect(p.x + 26).toBeLessThan(a.x1);
        expect(p.y - 44).toBeGreaterThan(a.y0 + 80);
        expect(p.y + 4).toBeLessThan(a.y1 - 40);
      }
      for (let i = 0; i < spaced.length; i++)
        for (let j = i + 1; j < spaced.length; j++) {
          const p = spaced[i],
            q = spaced[j];
          expect(
            Math.hypot((p.x - q.x) / (p.radiusX + q.radiusX), (p.y - q.y) / (p.radiusY + q.radiusY)),
          ).toBeGreaterThan(0.9);
        }
    }
  }
});

it('keeps the full adult capacity apart in each enclosure size while roaming and eating', () => {
  for (const [level, count] of [
    [0, 9],
    [1, 17],
    [2, 24],
  ] as const) {
    const a = farmUnitArea('livestock', level),
      safe = { x0: a.x0 + 34, x1: a.x1 - 34, y0: a.y0 + 125, y1: a.y1 - 53 };
    for (let t = -1; t < 180000; t += 1900) {
      const points = Array.from({ length: count }, (_, i) => {
        const pose =
          t < 0
            ? {
                x: Math.max(safe.x0, Math.min(safe.x1, a.x0 + (a.x1 - a.x0) * 0.59 + ((i % 4) - 1.5) * 38)),
                y: a.y0 + 145 + Math.floor(i / 4) * 32,
              }
            : farmRoamPose(safe, i, t);
        return { ...pose, radiusX: 23.5, radiusY: 11 };
      });
      const spaced = separateFarmHerd(points, safe);
      for (const p of spaced) {
        expect(p.x).toBeGreaterThanOrEqual(safe.x0);
        expect(p.x).toBeLessThanOrEqual(safe.x1);
        expect(p.y).toBeGreaterThanOrEqual(safe.y0);
        expect(p.y).toBeLessThanOrEqual(safe.y1);
      }
      for (let i = 0; i < count; i++)
        for (let j = i + 1; j < count; j++)
          expect(Math.hypot((spaced[i].x - spaced[j].x) / 47, (spaced[i].y - spaced[j].y) / 22)).toBeGreaterThan(0.9);
    }
  }
});
