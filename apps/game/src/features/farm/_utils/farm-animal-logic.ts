import type { Area } from '@/game/movement/movement-logic';

export type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
export { ANIMAL_STAGE_NAMES, FARM_ANIMALS, farmAnimalStage } from '@chibi-town/game-content/farm-animal-logic';

function random(index: number, segment: number, axis: number) {
  const n = Math.sin(index * 127.1 + segment * 311.7 + axis * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Smooth irregular destinations with pauses. Every interpolation stays in the safe rectangle. */
export function farmRoamPose(area: Area, index: number, time: number, swimming = false) {
  const duration = swimming ? 4600 + index * 317 : 6200 + index * 431;
  const clock = Math.max(0, time) / duration + index * 0.37;
  const segment = Math.floor(clock),
    phase = clock - segment;
  const travel = Math.min(1, phase / (swimming ? 1 : 0.78));
  const t = travel * travel * (3 - 2 * travel);
  const fromX = random(index + 1, segment, 0),
    toX = random(index + 1, segment + 1, 0);
  const fromY = random(index + 1, segment, 1),
    toY = random(index + 1, segment + 1, 1);
  const dx = (toX - fromX) * (area.x1 - area.x0),
    dy = (toY - fromY) * (area.y1 - area.y0);
  return {
    x: area.x0 + (fromX + (toX - fromX) * t) * (area.x1 - area.x0),
    y: area.y0 + (fromY + (toY - fromY) * t) * (area.y1 - area.y0),
    angle: Math.atan2(dy, dx),
    moving: travel < 1 && Math.hypot(dx, dy) > 4,
  };
}

export type FarmHerdPoint = { x: number; y: number; radiusX: number; radiusY: number };

/** Resolve soft body spacing inside the enclosure; never push a neighbour outside the fence. */
export function separateFarmHerd<T extends FarmHerdPoint>(points: T[], safe: Area) {
  for (let pass = 0; pass < 16; pass++) {
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j],
          rx = a.radiusX + b.radiusX,
          ry = a.radiusY + b.radiusY;
        const dx = (b.x - a.x) / rx,
          dy = (b.y - a.y) / ry,
          d = Math.hypot(dx, dy);
        if (d >= 1) continue;
        const nx = d > 0.001 ? dx / d : Math.cos(i * 2.4 + j),
          ny = d > 0.001 ? dy / d : Math.sin(i * 2.4 + j);
        const push = (1 - d) * 0.51;
        a.x -= nx * rx * push;
        a.y -= ny * ry * push;
        b.x += nx * rx * push;
        b.y += ny * ry * push;
      }
    for (const p of points) {
      p.x = Math.max(safe.x0, Math.min(safe.x1, p.x));
      p.y = Math.max(safe.y0, Math.min(safe.y1, p.y));
    }
  }
  return points;
}
