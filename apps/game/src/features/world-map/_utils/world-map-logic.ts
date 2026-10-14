import type { Point, WorldZone } from '@/features/world-map/_utils/world-map-data';

/** Trọng số pha sáng của cảnh: tổng luôn bằng 1. */
export type Lighting = { day: number; evening: number; night: number; dawn: number };

// Separate pastel dawn from warm sunset; each row sums to one.
const KEYS: [number, number, number, number, number][] = [
  [0, 0, 0, 1, 0],
  [4.5, 0, 0, 1, 0],
  [5.5, 0, 0, 0.35, 0.65],
  [6.1, 0, 0, 0, 1],
  [7.3, 1, 0, 0, 0],
  [13, 1, 0, 0, 0],
  [14, 0.9, 0.1, 0, 0],
  [16, 0.45, 0.55, 0, 0],
  [17.2, 0.2, 0.8, 0, 0],
  [18, 0, 1, 0, 0],
  [18.7, 0, 0.85, 0.15, 0],
  [19.5, 0, 0.35, 0.65, 0],
  [20.5, 0, 0, 1, 0],
  [24, 0, 0, 1, 0],
];

/** Ánh sáng theo giờ trong ngày (0–24, nhận cả giá trị ngoài khoảng). */
export function lightingAt(hour: number): Lighting {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < KEYS.length; i++) {
    const [h1, d1, e1, n1, a1] = KEYS[i];
    const [h0, d0, e0, n0, a0] = KEYS[i - 1];
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0);
      const day = d0 + (d1 - d0) * t;
      const evening = e0 + (e1 - e0) * t;
      const night = n0 + (n1 - n0) * t;
      const dawn = a0 + (a1 - a0) * t;
      const sum = day + evening + night + dawn;
      return { day: day / sum, evening: evening / sum, night: night / sum, dawn: dawn / sum };
    }
  }
  return { day: 0, evening: 0, night: 1, dawn: 0 };
}

/** Named phase shared by the real clock and manual preview indicators. */
export function worldTimePhase(hour: number): 'dawn' | 'day' | 'evening' | 'sunset' | 'night' {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 19.5) return 'night';
  if (h < 7.3) return 'dawn';
  if (h < 14) return 'day';
  if (h < 17.2) return 'evening';
  return 'sunset';
}

/** Vietnam wall clock at minute precision; epoch arithmetic is independent of browser timezone. */
export function vietnamHour(browserNow: number, serverOffsetMs = 0): number {
  const minutes = Math.floor((browserNow + serverOffsetMs) / 60_000) + 7 * 60;
  return (((minutes % 1440) + 1440) % 1440) / 60;
}

export function pointInPolygon([x, y]: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function zoneAt(point: Point, zones: readonly WorldZone[]): WorldZone | undefined {
  return zones.find((zone) => pointInPolygon(point, zone.area));
}

/** Art-directed point on land; never average boundary vertices (concave coasts may average into water). */
export function zoneCenter(zone: WorldZone): Point {
  return zone.focusAt;
}

/** Walk a polyline out and back, pausing at both ends without teleporting. */
export function walkRoute(route: readonly Point[], seconds: number, speed: number, pause = 2) {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  if (total === 0 || speed <= 0) return { at: route[0], moving: false, facingLeft: false };
  const travel = total / speed;
  const half = travel + pause;
  const t = ((seconds % (half * 2)) + half * 2) % (half * 2);
  const returning = t >= half;
  const local = returning ? t - half : t;
  let distance = Math.min(local, travel) * speed;
  if (returning) distance = total - distance;
  for (const [i, length] of lengths.entries()) {
    if (distance <= length || i === lengths.length - 1) {
      const a = route[i];
      const b = route[i + 1];
      const k = length ? distance / length : 0;
      return {
        at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as Point,
        moving: local < travel,
        facingLeft: returning ? b[0] > a[0] : b[0] < a[0],
      };
    }
    distance -= length;
  }
  return { at: route[0], moving: false, facingLeft: false };
}

/** Ground footprints authored against the source painting, separate from selectable zones. */
export function walkableAt(point: Point, walkways: readonly { polygon: readonly Point[] }[]): boolean {
  return [
    [0, 0],
    [-3, 0],
    [3, 0],
    [0, -1],
    [0, 1],
  ].every(([dx, dy]) => walkways.some((surface) => pointInPolygon([point[0] + dx, point[1] + dy], surface.polygon)));
}
