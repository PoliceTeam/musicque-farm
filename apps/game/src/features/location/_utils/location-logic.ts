import type { MapDefinition } from '@chibi-town/game-content';

/** Move a foot anchor with axis sliding; bounded substeps prevent tunnelling. */
export function moveInLocation(
  map: MapDefinition,
  position: readonly [number, number],
  delta: readonly [number, number],
): [number, number] {
  let [x, y] = position;
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 4));

  const blocked = (px: number, py: number) =>
    (map.obstacles ?? []).some((box) => px + 8 > box.x0 && px - 8 < box.x1 && py + 4 > box.y0 && py - 4 < box.y1);

  for (let i = 0; i < steps; i++) {
    const nx = Math.max(8, Math.min(map.width - 8, x + delta[0] / steps));
    if (!blocked(nx, y)) x = nx;
    const ny = Math.max(4, Math.min(map.height - 4, y + delta[1] / steps));
    if (!blocked(x, ny)) y = ny;
  }
  return [x, y];
}
