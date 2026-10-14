import { FARM_CLUSTERS } from '@chibi-town/game-content/farm-land-config';

export { FARM_CLUSTERS } from '@chibi-town/game-content/farm-land-config';

import { FARM_UNIT_LIMITS } from '@chibi-town/gameplay/farm-unit-logic';
import type { Area } from '@/game/movement/movement-logic';

export type FarmPoint = [number, number];
export type FarmFeature = { id: string; name: string; area: Area; stand: FarmPoint; description: string };
export type FarmSelection = { stand: FarmPoint; area?: Area };
export const FARM_EGG_BASKET_SPOTS = [
  { species: 'hen', x: 380, y: 360 },
  { species: 'duck', x: 488, y: 360 },
] as const;
export const FARM_WORLD = { width: 1280, height: 720 };
export const FARM_CHARACTER_SCALE = 0.85;
export const FARM_WALK_AREA: Area = { x0: 35, x1: 1240, y0: 175, y1: 680 };
export const FARM_SPAWN: FarmPoint = [640, 630];
export const FARM_PLOT_SIZE = { width: 40, height: 40 };
/** Shared lawn boundaries: 44px side lanes and a 60px cross lane (371..431). */
export const FARM_LAWNS = [
  [25, 175, 285, 488],
  [354, 165, 190, 206],
  [588, 181, 424, 190],
  [354, 431, 190, 232],
  [588, 431, 190, 232],
  [822, 431, 190, 232],
  [1056, 175, 214, 488],
] as const;
export const FARM_PLOTS = FARM_CLUSTERS.flatMap((cluster) =>
  Array.from({ length: cluster.count }, (_, cell) => {
    const x = cluster.x + (cell % cluster.columns) * cluster.stride;
    const y = cluster.y + Math.floor(cell / cluster.columns) * 60;
    return {
      id: `plot-${cluster.start + cell + 1}`,
      number: cluster.start + cell + 1,
      unlocked: cluster.start === 0 && cell < 6,
      area: { x0: x, x1: x + 40, y0: y, y1: y + 40 },
      stand: [x + 50, y + 53] as FarmPoint,
    };
  }),
);
export const FARM_OPEN_PLOTS = FARM_PLOTS.filter((p) => p.unlocked);
export const FARM_NEXT_PLOT = FARM_PLOTS[6];
export type FarmUnitLevels = { livestock: 0 | 1 | 2; pond: 0 | 1 | 2 };

export function farmUnitArea(id: keyof FarmUnitLevels, level: 0 | 1 | 2): Area {
  const slots = {
    livestock: [
      { x0: 65, x1: 285, y0: 220, y1: 535 },
      { x0: 50, x1: 300, y0: 210, y1: 595 },
      { x0: 35, x1: 310, y0: 200, y1: 650 },
    ],
    pond: [
      { x0: 1060, x1: 1266, y0: 200, y1: 485 },
      { x0: 1060, x1: 1266, y0: 190, y1: 570 },
      { x0: 1060, x1: 1266, y0: 180, y1: 665 },
    ],
  };
  return { ...slots[id][level] };
}

export function farmFeaturesFor(levels: FarmUnitLevels = { livestock: 0, pond: 0 }): FarmFeature[] {
  const livestock = farmUnitArea('livestock', levels.livestock),
    pond = farmUnitArea('pond', levels.pond);
  return [
    {
      id: 'store',
      name: 'Nhà kho',
      area: { x0: 464, x1: 539, y0: 150, y1: 270 },
      stand: [502, 300],
      description: 'Hạt giống và nông sản thu hoạch được cất tại đây.',
    },
    {
      id: 'livestock',
      name: 'Khu chăn nuôi',
      area: livestock,
      stand: [livestock.x0 + (livestock.x1 - livestock.x0) * 0.59, livestock.y0 + 135],
      description: 'Chuồng chung cho bò, lợn và cừu. Gia cầm chạy tự do bên ngoài.',
    },
    {
      id: 'kitchen',
      name: 'Nhà bếp',
      area: { x0: 359, x1: 459, y0: 150, y1: 270 },
      stand: [409, 300],
      description: 'Khu chế biến nông sản · Chưa mở trong bản thử.',
    },
    {
      id: 'pond',
      name: 'Ao cá',
      area: pond,
      stand: [1034, 390],
      description: 'Cho cá ăn để lớn; thu hoạch cá trưởng thành vào kho rồi mua lứa mới.',
    },
  ];
}

export const FARM_FEATURES = farmFeaturesFor();

/** Crops are walkable ground; only structures, fences and water block movement. */
export function farmObstaclesFor(features: FarmFeature[]): Area[] {
  return [
    { x0: 0, x1: 1280, y0: 0, y1: 172 },
    { x0: 0, x1: 574, y0: 686, y1: 720 },
    { x0: 704, x1: 1280, y0: 686, y1: 720 },
    ...features.flatMap((f) => (f.id === 'livestock' ? farmPenObstacles(f.area) : [f.area])),
  ];
}

/** East-facing 72px entrance. Pen floor is walkable; fence and fixtures are solid. */
export function farmPenObstacles(a: Area): Area[] {
  const w = a.x1 - a.x0,
    feedX = a.x0 + w * 0.59;
  return [
    { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y0 + 8 },
    { x0: a.x0, x1: a.x1, y0: a.y1 - 8, y1: a.y1 },
    { x0: a.x0, x1: a.x0 + 8, y0: a.y0, y1: a.y1 },
    { x0: a.x1 - 8, x1: a.x1, y0: a.y0, y1: 354 },
    { x0: a.x1 - 8, x1: a.x1, y0: 426, y1: a.y1 },
    { x0: a.x0 + 15, x1: a.x0 + 94, y0: a.y0 + 15, y1: a.y0 + 92 },
    { x0: feedX - 25, x1: feedX + 25, y0: a.y0 + 47, y1: a.y0 + 100 },
    { x0: a.x1 - 66, x1: a.x1 - 20, y0: a.y1 - 40, y1: a.y1 - 18 },
    { x0: a.x0 + 20, x1: a.x0 + 50, y0: a.y1 - 40, y1: a.y1 - 16 },
  ];
}

export const FARM_OBSTACLES = farmObstaclesFor(FARM_FEATURES);

export function inside(area: Area, x: number, y: number, padding = 0) {
  return x >= area.x0 - padding && x <= area.x1 + padding && y >= area.y0 - padding && y <= area.y1 + padding;
}

export function farmFeatureAt(x: number, y: number, features = FARM_FEATURES, capacity?: { livestock: number }) {
  return features.find(
    ({ id, area }) =>
      inside(area, x, y) ||
      (id === 'livestock' &&
        (capacity ? capacity.livestock < FARM_UNIT_LIMITS.livestock : area.x1 < farmUnitArea('livestock', 2).x1) &&
        inside({ x0: area.x1 + 8, x1: area.x1 + 38, y0: 398, y1: 436 }, x, y)),
  );
}

export function farmPlotAt(x: number, y: number, owned = 6) {
  return FARM_PLOTS.slice(0, owned).find(({ area }) => inside(area, x, y));
}

export function farmExpansionAt(x: number, y: number, owned = 6) {
  return owned < FARM_PLOTS.length && inside(FARM_PLOTS[owned].area, x, y);
}

/** Buy signs open the shop; ordinary enclosure clicks open care. Hidden signs cannot be clicked. */
export function farmUnitPurchaseAt(
  x: number,
  y: number,
  features = FARM_FEATURES,
  capacity: { livestock: number; pond: number },
) {
  return features.find(({ id, area }) =>
    id === 'livestock'
      ? capacity.livestock < FARM_UNIT_LIMITS.livestock &&
        inside({ x0: area.x1 + 8, x1: area.x1 + 38, y0: 398, y1: 436 }, x, y)
      : id === 'pond' &&
        capacity.pond < FARM_UNIT_LIMITS.pond &&
        inside({ x0: area.x0 + 4, x1: area.x0 + 38, y0: area.y1 - 55, y1: area.y1 - 15 }, x, y),
  );
}
