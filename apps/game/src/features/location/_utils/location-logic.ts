import type { MapDefinition } from '@chibi-town/game-content';

/** Move a foot anchor with axis sliding; bounded substeps prevent tunnelling. */
export function moveInLocation(
  map: MapDefinition,
  position: readonly [number, number],
  delta: readonly [number, number],
  output: [number, number] = [0, 0],
): [number, number] {
  let [x, y] = position;
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 4));

  for (let i = 0; i < steps; i++) {
    const nx = Math.max(8, Math.min(map.width - 8, x + delta[0] / steps));
    if (!locationBlocked(map, nx, y)) x = nx;
    const ny = Math.max(4, Math.min(map.height - 4, y + delta[1] / steps));
    if (!locationBlocked(map, x, ny)) y = ny;
  }
  output[0] = x;
  output[1] = y;
  return output;
}

function locationBlocked(map: MapDefinition, x: number, y: number) {
  if (map.obstacles)
    for (const box of map.obstacles)
      if (x + 8 > box.x0 && x - 8 < box.x1 && y + 4 > box.y0 && y - 4 < box.y1) return true;
  return false;
}
