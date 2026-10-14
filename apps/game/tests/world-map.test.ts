import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sprites from '@/assets/map/sprites.json';
import life from '@/assets/map/world-map-life.json';
import { WORLD_DECOR, WORLD_MAP_SIZE, WORLD_WALKWAYS, WORLD_ZONES } from '@/features/world-map/_utils/world-map-data';
import {
  lightingAt,
  pointInPolygon,
  vietnamHour,
  walkableAt,
  walkRoute,
  zoneAt,
  zoneCenter,
} from '@/features/world-map/_utils/world-map-logic';

const inside = ([x, y]: readonly [number, number]) =>
  x >= 0 && y >= 0 && x <= WORLD_MAP_SIZE.width && y <= WORLD_MAP_SIZE.height;

describe('world map data', () => {
  it('keeps every zone, label and decor point on the map image', () => {
    expect(new Set(WORLD_ZONES.map((z) => z.id)).size).toBe(WORLD_ZONES.length);
    for (const zone of WORLD_ZONES) {
      expect(zone.area.length).toBeGreaterThanOrEqual(3);
      for (const p of zone.area) expect(inside(p), zone.id).toBe(true);
      expect(inside(zone.labelAt), zone.id).toBe(true);
      expect(zoneAt(zoneCenter(zone), WORLD_ZONES)?.id, zone.id).toBe(zone.id);
    }
    for (const p of [...WORLD_DECOR.fountains, ...WORLD_DECOR.smoke, ...WORLD_DECOR.lighthouses])
      expect(inside(p)).toBe(true);
  });

  it('finds the zone under well-known landmarks and none in open sky', () => {
    expect(zoneAt([304, 387], WORLD_ZONES)?.id).toBe('farm'); // cối xay
    expect(zoneAt([443, 634], WORLD_ZONES)?.id).toBe('fun'); // vòng quay
    expect(zoneAt([798, 549], WORLD_ZONES)?.id).toBe('center'); // đài phun nước
    expect(zoneAt([1139, 715], WORLD_ZONES)?.id).toBe('port'); // hải đăng cảng
    expect(zoneAt([1490, 662], WORLD_ZONES)?.id).toBe('airport');
    expect(zoneAt([1000, 40], WORLD_ZONES)).toBeUndefined();
    for (const water of [
      [600, 440],
      [620, 775],
      [1225, 845],
      [1460, 515],
    ] as const) {
      expect(zoneAt(water, WORLD_ZONES), `open water ${water}`).toBeUndefined();
    }
    expect(
      pointInPolygon(
        [5, 5],
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      ),
    ).toBe(true);
  });
});

describe('world map sprites', () => {
  it('has every reused label and boat texture regardless of its v1 source position', () => {
    const names = WORLD_DECOR.boats.map((b) => b.sprite);
    for (const zone of WORLD_ZONES) names.push(`label-${zone.id}`);
    const meta = sprites as Record<string, { x: number; y: number; w: number; h: number }>;
    for (const name of names) {
      expect(meta[name], name).toBeDefined();
      expect(existsSync(new URL(`../src/assets/map/sprites/${name}.png`, import.meta.url)), name).toBe(true);
      expect(meta[name].w, name).toBeGreaterThan(0);
      expect(meta[name].h, name).toBeGreaterThan(0);
    }
  });
});

describe('time of day', () => {
  it('blends day, evening and night weights that always sum to one', () => {
    for (let h = -2; h <= 26; h += 0.25) {
      const l = lightingAt(h);
      expect(l.day + l.evening + l.night + l.dawn).toBeCloseTo(1, 6);
      for (const v of Object.values(l)) expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(lightingAt(12)).toEqual({ day: 1, evening: 0, night: 0, dawn: 0 });
    expect(lightingAt(6.1).dawn).toBeCloseTo(1, 12);
    expect(lightingAt(6.1).evening).toBe(0);
    expect(lightingAt(22).night).toBe(1);
    expect(lightingAt(18)).toEqual({ day: 0, evening: 1, night: 0, dawn: 0 }); // hoàng hôn
  });

  it('uses Vietnam time independent of the timestamp timezone representation', () => {
    expect(vietnamHour(Date.parse('2026-10-14T02:23:59Z'))).toBeCloseTo(9 + 23 / 60);
    expect(vietnamHour(Date.parse('2026-10-13T19:23:59-07:00'))).toBeCloseTo(9 + 23 / 60);
    expect(vietnamHour(Date.parse('2026-10-14T09:23:00+07:00'))).toBeCloseTo(9 + 23 / 60);
  });
  it('corrects browser skew and wraps the day at minute precision', () => {
    expect(vietnamHour(Date.parse('2026-10-14T16:59:59Z'))).toBeCloseTo(23 + 59 / 60);
    expect(vietnamHour(Date.parse('2026-10-14T16:59:59Z'), 1000)).toBe(0);
    expect(vietnamHour(Date.parse('2026-10-14T17:00:00Z'), -60_000)).toBeCloseTo(23 + 59 / 60);
    expect(vietnamHour(-8 * 3600_000)).toBe(23);
  });
});

// An RGBA mask with alpha used as data loses RGB under premultiplied texture upload.
describe('world map data textures', () => {
  it('stores shader masks as opaque RGB PNGs', () => {
    for (const file of ['world-map-mask.png', 'world-map-zones.png', 'world-map-surf.png']) {
      const png = readFileSync(new URL(`../src/assets/map/${file}`, import.meta.url));
      expect(png.subarray(1, 4).toString(), file).toBe('PNG');
      expect(png.readUInt32BE(16), file).toBe(WORLD_MAP_SIZE.width);
      expect(png.readUInt32BE(20), file).toBe(WORLD_MAP_SIZE.height);
      expect(png[25], file).toBe(2); // PNG color type 2 = RGB, no alpha.
    }
  });
});

describe('world map walking routes', () => {
  it('walks corners continuously and pauses before reversing', () => {
    const route = [
      [0, 0],
      [10, 0],
      [10, 10],
    ] as const;
    expect(walkRoute(route, 1, 10).at).toEqual([10, 0]);
    expect(walkRoute(route, 2.5, 10)).toEqual({ at: [10, 10], moving: false, facingLeft: false });
    expect(walkRoute(route, 5, 10).at).toEqual([10, 0]);
    expect(walkRoute(route, 5.5, 10).facingLeft).toBe(true);
    expect(walkRoute(route, 7, 10).moving).toBe(false);
    expect(walkRoute(route, 8, 10).at).toEqual([0, 0]);
    expect(
      walkRoute(
        [
          [2, 3],
          [2, 3],
        ],
        10,
        5,
      ).at,
    ).toEqual([2, 3]);
  });

  it('keeps the whole foot on an independently authored ground surface throughout the cycle', () => {
    for (const path of WORLD_DECOR.pedestrians) {
      for (let t = 0; t < 180; t += 0.5) {
        const motion = walkRoute(path.route, t, path.speed);
        expect(walkableAt(motion.at, WORLD_WALKWAYS), `${path.zone}: ${motion.at}`).toBe(true);
      }
    }
  });
});

describe('world map ground regression', () => {
  it('rejects sea and the vertical faces below the decks', () => {
    for (const point of [
      [891, 728],
      [390, 722],
      [422, 730],
      [600, 850],
    ] as const)
      expect(walkableAt(point, WORLD_WALKWAYS), `${point}`).toBe(false);
    expect(walkableAt([950, 728], WORLD_WALKWAYS)).toBe(true);
  });
  it('keeps the girl, farmer and cow moving within their own ground surfaces', () => {
    for (const actor of life) {
      if (!('route' in actor) || !actor.route) continue;
      for (let t = 0; t < 180; t += 0.25) {
        const motion = walkRoute(actor.route as [number, number][], t, actor.speed!);
        expect(walkableAt(motion.at, WORLD_WALKWAYS), `${actor.id}: ${motion.at}`).toBe(true);
      }
    }
  });
});
