import { acquireSceneAssets } from '@/game/rendering/map-assets';

export const RACE_SCENERY_IDS = [
  'scenery:cloud',
  'scenery:skyline',
  'scenery:tree',
  'scenery:tree-alt',
  'scenery:flower-patch',
  'scenery:shrubs',
  'pet-racing/bench.webp',
  'pet-racing/turf.webp',
  'pet-racing/dirt.webp',
  'pet-racing/track-curb.webp',
  'pet-racing/fence.webp',
] as const;

/** Street and race scenery share image sources and the same resource cache. */
export function loadRaceScenery() {
  return acquireSceneAssets(RACE_SCENERY_IDS);
}
