import { createFarmProgress, parseFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmFeedingBlend, farmFoodPercent, feedFarmUnit } from '@chibi-town/gameplay/farm-feeding-logic';
import { describe, expect, it } from 'vitest';
import { FARM_SPAWN, farmFeatureAt, farmFeaturesFor, farmObstaclesFor } from '@/features/farm/_utils/farm-layout';
import { farmRoute, farmSegmentClear, farmWalkable } from '@/features/farm/_utils/farm-path-logic';

describe('feeding and enclosure access', () => {
  it('charges once, stores fullness offline, separates pond food and refuses insufficient coins', () => {
    const p = createFarmProgress();
    p.animals = [{ species: 'pig', boughtAt: 0 }];
    p.fish = [{ species: 'fish', boughtAt: 0 }];
    expect(farmFoodPercent(p, 'livestock', 1000)).toBe(0);
    expect(feedFarmUnit(p, 'livestock', 1000)).toBe(true);
    expect(p.coins).toBe(29950);
    expect(feedFarmUnit(p, 'livestock', 1000)).toBe(false);
    expect(farmFoodPercent(p, 'pond', 1000)).toBe(0);
    expect(feedFarmUnit(p, 'pond', 1000)).toBe(true);
    expect(p.coins).toBe(29925);
    const restored = parseFarmProgress(JSON.parse(JSON.stringify(p)));
    expect(farmFoodPercent(restored, 'livestock', 1000 + 6 * 3600000)).toBe(50);
    expect(farmFoodPercent(restored, 'livestock', 1000 + 12 * 3600000)).toBe(0);
    restored.coins = 49;
    expect(feedFarmUnit(restored, 'livestock', 1000 + 12 * 3600000)).toBe(false);
    expect(restored.fedAt.livestock).toBe(1000);
    expect(feedFarmUnit(restored, 'pond', NaN)).toBe(false);
    expect(farmFeedingBlend(1000, 1000)).toBe(0);
    expect(farmFeedingBlend(1000, 4000)).toBe(1);
    expect(farmFeedingBlend(1000, 21000)).toBe(0);
  });
  it('migrates missing food state without losing prior plots or money', () => {
    const p = createFarmProgress();
    const { fedAt: _, ...old } = p;
    expect(parseFarmProgress(old).fedAt).toEqual({ livestock: null, poultry: null, pond: null });
    expect(parseFarmProgress({ ...p, fedAt: { livestock: -1, pond: 'bad' } }).fedAt).toEqual({
      livestock: null,
      poultry: null,
      pond: null,
    });
  });
  it('enters and exits through the actual opening at every expansion but cannot cross other fence sections', () => {
    for (const level of [0, 1, 2] as const) {
      const features = farmFeaturesFor({ livestock: level, pond: level }),
        pen = features.find((f) => f.id === 'livestock')!,
        a = pen.area;
      const obstacles = farmObstaclesFor(features);
      const route = farmRoute(FARM_SPAWN, pen.stand, obstacles);
      expect(route.at(-1)).toEqual(pen.stand);
      expect(farmFeatureAt(a.x1 + 23, 417, features)?.id).toBe(level < 2 ? 'livestock' : undefined);
      let previous = FARM_SPAWN;
      for (const point of route) {
        expect(farmSegmentClear(previous, point, obstacles)).toBe(true);
        previous = point;
      }
      expect(farmRoute(pen.stand, FARM_SPAWN, obstacles).at(-1)).toEqual(FARM_SPAWN);
      expect(farmSegmentClear([a.x1 + 20, 390], [a.x1 - 25, 390], obstacles)).toBe(true);
      expect(farmSegmentClear([a.x1 + 20, 460], [a.x1 - 25, 460], obstacles)).toBe(false);
      expect(farmWalkable(a.x0 + 53, a.y0 + 70, obstacles)).toBe(false);
    }
  });
});
