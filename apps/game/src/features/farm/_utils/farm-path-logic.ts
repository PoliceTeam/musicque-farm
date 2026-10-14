import {
  FARM_OBSTACLES,
  FARM_WALK_AREA,
  FARM_WORLD,
  type FarmPoint,
  inside,
} from '@/features/farm/_utils/farm-map-data';
import type { Area } from '@/game/movement/movement-logic';

const CELL = 8;
const COLS = Math.ceil(FARM_WORLD.width / CELL);
const ROWS = Math.ceil(FARM_WORLD.height / CELL);
const FOOT_RADIUS = 6;

export function farmWalkable(x: number, y: number, obstacles = FARM_OBSTACLES) {
  return inside(FARM_WALK_AREA, x, y) && !obstacles.some((area) => inside(area, x, y, FOOT_RADIUS));
}

export function farmSegmentClear(from: FarmPoint, to: FarmPoint, obstacles = FARM_OBSTACLES) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!farmWalkable(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, obstacles)) return false;
  }
  return true;
}

const point = (id: number): FarmPoint => [(id % COLS) * CELL + CELL / 2, Math.floor(id / COLS) * CELL + CELL / 2];

function nearest(value: FarmPoint, obstacles: Area[]) {
  let best = -1;
  let distance = Infinity;
  for (let id = 0; id < COLS * ROWS; id++) {
    const p = point(id);
    const d = Math.hypot(p[0] - value[0], p[1] - value[1]);
    if (d < distance && farmWalkable(...p, obstacles)) {
      best = id;
      distance = d;
    }
  }
  return best;
}

/** Grid search with collision-checked links. Blocked clicks resolve to the nearest safe ground. */
export function farmRoute(from: FarmPoint, requested: FarmPoint, obstacles = FARM_OBSTACLES): FarmPoint[] {
  if (!farmWalkable(...from, obstacles)) return [];
  const start = nearest(from, obstacles);
  const finish = nearest(requested, obstacles);
  if (start < 0 || finish < 0) return [];
  const target = farmWalkable(...requested, obstacles) ? requested : point(finish);
  if (farmSegmentClear(from, target, obstacles)) return [target];
  if (!farmSegmentClear(from, point(start), obstacles)) return [];
  const queue = [start];
  const previous = new Map<number, number>([[start, -1]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    if (id === finish) break;
    const col = id % COLS;
    const row = Math.floor(id / COLS);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const next = r * COLS + c;
      if (previous.has(next) || !farmSegmentClear(point(id), point(next), obstacles)) continue;
      previous.set(next, id);
      queue.push(next);
    }
  }
  if (!previous.has(finish)) return [];
  const route: FarmPoint[] = [];
  for (let id = finish; id !== -1; id = previous.get(id)!) route.unshift(point(id));
  if (farmSegmentClear(point(finish), target, obstacles)) route.push(target);
  const simplified: FarmPoint[] = [];
  let anchor = from;
  while (route.length) {
    let last = 0;
    for (let i = 1; i < route.length; i++) {
      if (!farmSegmentClear(anchor, route[i], obstacles)) break;
      last = i;
    }
    anchor = route[last];
    simplified.push(anchor);
    route.splice(0, last + 1);
  }
  return simplified;
}
