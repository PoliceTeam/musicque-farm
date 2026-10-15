import { FARM_PLOT_LIMIT } from '@chibi-town/game-content/farm-land-config';
import { describe, expect, it } from 'vitest';
import {
  FARM_FEATURES,
  FARM_LAWNS,
  FARM_NEXT_PLOT,
  FARM_OPEN_PLOTS,
  FARM_PLOTS,
  FARM_SPAWN,
  type FarmPoint,
  farmExpansionAt,
  farmFeaturesFor,
  farmObstaclesFor,
  farmPlotAt,
  farmUnitArea,
} from '@/features/farm/_utils/farm-layout';
import { farmRoute, farmSegmentClear, farmWalkable } from '@/features/farm/_utils/farm-path-logic';

describe('farm layout and safe routes', () => {
  it('has the configured number of stable plots and exactly six unlocked, at a safe spawn', () => {
    expect(FARM_PLOTS).toHaveLength(FARM_PLOT_LIMIT);
    expect(new Set(FARM_PLOTS.map((p) => p.id)).size).toBe(FARM_PLOT_LIMIT);
    expect(FARM_PLOTS.filter((p) => p.unlocked)).toHaveLength(6);
    expect(farmWalkable(...FARM_SPAWN)).toBe(true);
  });
  it('keeps consistent lawn lanes and a clear cross lane with all units and plots expanded', () => {
    const [pen, buildings, upper, left, middle, right, pond] = FARM_LAWNS;
    for (const [a, b] of [
      [pen, left],
      [left, middle],
      [middle, right],
      [right, pond],
      [buildings, upper],
    ]) {
      expect(b[0] - (a[0] + a[2])).toBe(44);
    }
    expect(left[1] - (upper[1] + upper[3])).toBe(60);
    expect([left[1], middle[1], right[1]]).toEqual([431, 431, 431]);
    const obstacles = farmObstaclesFor(farmFeaturesFor({ livestock: 2, pond: 2 }));
    for (const x of [332, 566, 800, 1034]) {
      expect(farmSegmentClear([x, 382], [x, 640], obstacles)).toBe(true);
    }
    expect(farmSegmentClear([320, 400], [1046, 400], obstacles)).toBe(true);
    for (const plot of FARM_PLOTS) {
      expect(
        [upper, left, middle, right].some(
          ([x, y, w, h]) => plot.area.x0 >= x && plot.area.x1 <= x + w && plot.area.y0 >= y && plot.area.y1 <= y + h,
        ),
      ).toBe(true);
    }
  });
  it('only selects owned plots, exposes one next buy sign, and leaves future capacity as grass', () => {
    expect(FARM_OPEN_PLOTS).toHaveLength(6);
    expect(FARM_NEXT_PLOT.number).toBe(7);
    for (const plot of FARM_PLOTS) {
      const x = (plot.area.x0 + plot.area.x1) / 2;
      const y = (plot.area.y0 + plot.area.y1) / 2;
      expect(farmPlotAt(x, y)?.id).toBe(plot.unlocked ? plot.id : undefined);
      expect(farmExpansionAt(x, y)).toBe(plot.number === 7);
      if (!plot.unlocked) expect(farmWalkable(x, y)).toBe(true);
    }
  });
  it('reaches every plot and building interaction point without crossing obstacles', () => {
    for (const destination of [...FARM_PLOTS, ...FARM_FEATURES].map((p) => p.stand)) {
      const route = farmRoute(FARM_SPAWN, destination);
      expect(route.length).toBeGreaterThan(0);
      expect(route.at(-1)).toEqual(destination);
      let from = FARM_SPAWN;
      for (const to of route) {
        expect(farmSegmentClear(from, to)).toBe(true);
        from = to;
      }
    }
  });
  it('walks around the fields, projects water/building clicks onto safe ground, and rejects leaving the fence', () => {
    for (const target of [
      [1100, 400],
      [185, 250],
      [450, 245],
      [-500, 1000],
    ] as FarmPoint[]) {
      const route = farmRoute(FARM_SPAWN, target);
      expect(route.length).toBeGreaterThan(0);
      let from = FARM_SPAWN;
      for (const to of route) {
        expect(farmSegmentClear(from, to)).toBe(true);
        from = to;
      }
      expect(farmWalkable(...from)).toBe(true);
    }
    expect(farmWalkable(1100, 400)).toBe(false);
    expect(farmWalkable(185, 250)).toBe(true);
    expect(farmWalkable(118, 265)).toBe(false);
    expect(farmWalkable(120, 700)).toBe(false);
    expect(farmSegmentClear([1100, 606], [1100, 310])).toBe(false);
  });
});

describe('independent farm expansion footprints', () => {
  it('expands pond and livestock within their own reserved slots and keeps every interaction reachable', () => {
    const starter = farmFeaturesFor();
    for (const level of [0, 1, 2] as const) {
      const features = farmFeaturesFor({ pond: level, livestock: level });
      const obstacles = farmObstaclesFor(features);
      for (const feature of features) {
        const route = farmRoute(FARM_SPAWN, feature.stand, obstacles);
        expect(route.length).toBeGreaterThan(0);
        expect(route.at(-1)).toEqual(feature.stand);
        let from = FARM_SPAWN;
        for (const to of route) {
          expect(farmSegmentClear(from, to, obstacles)).toBe(true);
          from = to;
        }
      }
      for (const id of ['store', 'kitchen'])
        expect(features.find((f) => f.id === id)).toEqual(starter.find((f) => f.id === id));
    }
    const small = farmUnitArea('pond', 0);
    const large = farmUnitArea('pond', 2);
    expect(large.y0).toBeLessThan(small.y0);
    expect(large.y1).toBeGreaterThan(small.y1);
    const changedPoint: FarmPoint = [(small.x0 + small.x1) / 2, small.y1 + 20];
    expect(farmWalkable(...changedPoint, farmObstaclesFor(starter))).toBe(true);
    expect(farmWalkable(...changedPoint, farmObstaclesFor(farmFeaturesFor({ livestock: 0, pond: 2 })))).toBe(false);
  });
});

describe('fully unlocked modular farm', () => {
  it('takes a straight path through the first crop row instead of detouring around plots', () => {
    const from: FarmPoint = [590, 215],
      to: FarmPoint = [985, 215];
    for (const level of [0, 1, 2] as const) {
      const obstacles = farmObstaclesFor(farmFeaturesFor({ livestock: level, pond: level }));
      expect(farmSegmentClear(from, to, obstacles)).toBe(true);
      expect(farmRoute(from, to, obstacles)).toEqual([to]);
    }
  });
  it('keeps all plot centers and interaction points reachable across crops', () => {
    const obstacles = farmObstaclesFor(farmFeaturesFor({ livestock: 2, pond: 2 }));
    for (const plot of FARM_PLOTS) {
      const center: FarmPoint = [(plot.area.x0 + plot.area.x1) / 2, (plot.area.y0 + plot.area.y1) / 2];
      expect(farmWalkable(...center, obstacles)).toBe(true);
      expect(farmRoute(FARM_SPAWN, center, obstacles).at(-1)).toEqual(center);
      const route = farmRoute(FARM_SPAWN, plot.stand, obstacles);
      expect(route.at(-1)).toEqual(plot.stand);
      let previous: FarmPoint = FARM_SPAWN;
      for (const point of route) {
        expect(farmSegmentClear(previous, point, obstacles)).toBe(true);
        previous = point;
      }
    }
  });
});

it('fits every plot within its lawn with room for interaction and without overlapping plots', () => {
  const lawns = [
    [588, 181, 424, 190],
    [354, 431, 190, 232],
    [588, 431, 190, 232],
    [822, 431, 190, 232],
  ];
  for (const plot of FARM_PLOTS)
    expect(
      lawns.some(
        ([x, y, w, h]) =>
          plot.area.x0 >= x + 6 && plot.area.x1 <= x + w - 6 && plot.area.y0 >= y + 6 && plot.area.y1 <= y + h - 6,
      ),
    ).toBe(true);
  for (const [i, plot] of FARM_PLOTS.entries())
    for (const other of FARM_PLOTS.slice(i + 1))
      expect(
        plot.area.x1 <= other.area.x0 ||
          other.area.x1 <= plot.area.x0 ||
          plot.area.y1 <= other.area.y0 ||
          other.area.y1 <= plot.area.y0,
      ).toBe(true);
});
