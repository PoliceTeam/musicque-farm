import { describe, expect, it } from 'vitest';
import { FARM_FEATURES, farmUnitArea, farmUnitPurchaseAt } from '@/features/farm/_utils/farm-layout';
import { farmFishPose } from '@/features/farm/_utils/farm-pond-logic';

describe('fish stay in water after pond expansion', () => {
  it('keeps complete rotated fish sprites inside the shoreline across all pond sizes', () => {
    for (const level of [0, 1, 2] as const) {
      const a = farmUnitArea('pond', level),
        width = a.x1 - a.x0,
        height = a.y1 - a.y0;
      for (let index = 0; index < 9; index++)
        for (let time = 0; time < 120000; time += 137) {
          const pose = farmFishPose(width, height, index, time);
          expect(pose.x - 17).toBeGreaterThan(17);
          expect(pose.x + 17).toBeLessThan(width - 17);
          expect(pose.y - 17).toBeGreaterThan(17);
          expect(pose.y + 17).toBeLessThan(height - 17);
          expect(Number.isFinite(pose.angle)).toBe(true);
        }
    }
  });
});

describe('pond movement and separate purchase signs', () => {
  it('swims continuously across the old roaming segment boundaries', () => {
    for (let i = 0; i < 10; i++)
      for (let time = 0; time < 120000; time += 317) {
        const before = farmFishPose(260, 400, i, time),
          after = farmFishPose(260, 400, i, time + 16);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
        const turn = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
        expect(Math.abs(turn)).toBeLessThan(0.1);
      }
  });
  it('opens purchase only on visible signs, leaving enclosure clicks for care', () => {
    const capacity = { livestock: 10, pond: 2 };
    const pond = FARM_FEATURES.find((f) => f.id === 'pond')!;
    expect(farmUnitPurchaseAt(pond.area.x0 + 21, pond.area.y1 - 30, FARM_FEATURES, capacity)?.id).toBe('pond');
    expect(farmUnitPurchaseAt(pond.area.x0 + 100, pond.area.y0 + 100, FARM_FEATURES, capacity)).toBeUndefined();
    expect(
      farmUnitPurchaseAt(pond.area.x0 + 21, pond.area.y1 - 30, FARM_FEATURES, { livestock: 20, pond: 10 }),
    ).toBeUndefined();
  });
});
