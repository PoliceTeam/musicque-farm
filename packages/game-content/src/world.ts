import { arcadeMap } from './arcade-map.js';
import { entertainmentMap } from './entertainment.js';
import { shoppingMap } from './shopping.js';
export type RegionDefinition = { id: string; label: string; maps: readonly string[] };
export type MapLayer = {
  id: string;
  asset?: string;
  color?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  rotationSeconds?: number;
  drift?: { distance: number; seconds: number };
  destination?: { regionId: string; mapId: string };
  entrance?: readonly [number, number];
};
export type MapDefinition = {
  scene: 'farm' | 'location' | 'arcade';
  presentation?: 'street';
  channels?: { count: number; capacity: number };
  width: number;
  height: number;
  layers?: readonly MapLayer[];
  obstacles?: readonly { x0: number; y0: number; x1: number; y1: number }[];
  id: string;
  regionId: string;
  label: string;
  systems: readonly string[];
  spawn: readonly [number, number];
  portals: readonly {
    id: string;
    target: string;
    spawn: readonly [number, number];
    entrance?: readonly [number, number];
  }[];
};
export const REGIONS = [
  {
    id: 'farm',
    label: 'Nông trại',
    maps: ['farm-home'],
  },
  {
    id: 'forest',
    label: 'Rừng già',
    maps: [],
  },
  {
    id: 'school',
    label: 'Trường học',
    maps: [],
  },
  {
    id: 'center',
    label: 'Trung tâm',
    maps: ['shopping-street'],
  },
  {
    id: 'fun',
    label: 'Khu giải trí',
    maps: ['entertainment-street', 'arcade-hall'],
  },
  {
    id: 'homes',
    label: 'Khu nhà ở',
    maps: [],
  },
  {
    id: 'port',
    label: 'Cảng biển',
    maps: [],
  },
  {
    id: 'airport',
    label: 'Sân bay',
    maps: [],
  },
] as const;
export const MAPS: readonly MapDefinition[] = [
  {
    scene: 'farm',
    width: 1280,
    height: 720,
    id: 'farm-home',
    regionId: 'farm',
    label: 'Nông trại',
    systems: ['farming', 'animals'],
    spawn: [640, 630],
    portals: [{ id: 'exit', target: 'world', spawn: [405, 425] }],
  },
  entertainmentMap,
  shoppingMap,
  arcadeMap,
];

export function resolveMap(regionId: string, mapId: string) {
  return MAPS.find((map) => map.regionId === regionId && map.id === mapId);
}

export function validateWorld(
  registry: { regions: readonly RegionDefinition[]; maps: readonly MapDefinition[] } = { regions: REGIONS, maps: MAPS },
) {
  const regions = new Set(registry.regions.map((region) => region.id));
  if (regions.size !== registry.regions.length) throw new Error('Duplicate region');
  const ids = new Set<string>();
  for (const map of registry.maps) {
    if (ids.has(map.id) || !regions.has(map.regionId)) throw new Error('Invalid map definition');
    if (
      ![map.width, map.height].every((n) => Number.isFinite(n) && n > 0) ||
      !map.spawn.every(Number.isFinite) ||
      !['farm', 'location', 'arcade'].includes(map.scene) ||
      map.spawn[0] < 0 ||
      map.spawn[1] < 0 ||
      map.spawn[0] > map.width ||
      map.spawn[1] > map.height
    )
      throw new Error('Invalid map dimensions/spawn');
    if (
      map.channels &&
      (!Number.isSafeInteger(map.channels.count) ||
        map.channels.count < 1 ||
        map.channels.count > 1000 ||
        !Number.isSafeInteger(map.channels.capacity) ||
        map.channels.capacity < 1 ||
        map.channels.capacity > 10000)
    )
      throw new Error('Invalid channel configuration');
    if (new Set(map.portals.map((portal) => portal.id)).size !== map.portals.length)
      throw new Error('Duplicate portal');
    if (new Set((map.layers ?? []).map((layer) => layer.id)).size !== (map.layers ?? []).length)
      throw new Error('Duplicate layer');
    for (const layer of map.layers ?? [])
      if (
        ![layer.x, layer.y, layer.width, layer.height, layer.depth].every(Number.isFinite) ||
        layer.width <= 0 ||
        layer.height <= 0 ||
        (layer.destination !== undefined &&
          !registry.maps.some(
            (candidate) =>
              candidate.id === layer.destination?.mapId && candidate.regionId === layer.destination?.regionId,
          ))
      )
        throw new Error('Invalid layer');
    for (const box of map.obstacles ?? [])
      if (![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite) || box.x1 <= box.x0 || box.y1 <= box.y0)
        throw new Error('Invalid obstacle');
    ids.add(map.id);
  }
  for (const region of registry.regions)
    for (const id of region.maps)
      if (!registry.maps.some((map) => map.id === id && map.regionId === region.id))
        throw new Error('Invalid region entry');
  for (const map of registry.maps)
    for (const portal of map.portals) {
      if (portal.target !== 'world' && !ids.has(portal.target)) throw new Error('Invalid portal');
      const destination = registry.maps.find((candidate) => candidate.id === portal.target);
      if (
        !portal.spawn.every(Number.isFinite) ||
        portal.spawn.some((n) => n < 0) ||
        (destination && (portal.spawn[0] > destination.width || portal.spawn[1] > destination.height))
      )
        throw new Error('Invalid portal spawn');
    }
}

validateWorld();
