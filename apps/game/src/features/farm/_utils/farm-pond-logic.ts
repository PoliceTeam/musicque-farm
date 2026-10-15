import { separateFarmHerd } from '@/features/farm/_utils/farm-herd-logic';

/** Fish paths in local pond coordinates, with space for fins inside the shoreline. */
export function farmFishPose(width: number, height: number, index: number, time: number) {
  const phase = time / (13000 + index * 731) + index * 2.399;
  const vertical = phase * 0.83 + index * 1.71;
  const rx = (width - 80) / 2,
    ry = (height - 82) / 2;
  return {
    x: width / 2 + rx * Math.sin(phase),
    y: height / 2 + ry * Math.sin(vertical),
    angle: Math.atan2(ry * 0.83 * Math.cos(vertical), rx * Math.cos(phase)),
  };
}

/** Fish keep their fins inside the shore and spread out while roaming or gathering at food. */
export function farmFishGroup(
  width: number,
  height: number,
  count: number,
  time: number,
  feeding = 0,
  foodY = height / 2,
) {
  const safe = { x0: 40, y0: 41, x1: width - 40, y1: height - 41 };
  const points = Array.from({ length: count }, (_, i) => {
    const pose = farmFishPose(width, height, i, time);
    const x = 44 + (i % 3) * 33,
      y = Math.max(safe.y0, Math.min(safe.y1, foodY + (Math.floor(i / 3) - Math.floor(count / 6)) * 31));
    return {
      ...pose,
      x: pose.x + (x - pose.x) * feeding,
      y: pose.y + (y - pose.y) * feeding,
      radiusX: 14,
      radiusY: 14,
    };
  });
  return separateFarmHerd(points, safe);
}
