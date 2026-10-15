import type { CropId } from '@chibi-town/game-content/farm-catalog';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';

/** Reference v21: numbered plant growth frames followed by a produce icon where available.
 * Dragon fruit keeps the v9 cactus sequence because its new row contains roses.
 */
export const CROP_GROWTH_FRAMES: Record<CropId, { ripe: number; icon?: number }> = {
  starfruit: { ripe: 3, icon: 4 },
  tomato: { ripe: 5, icon: 6 },
  carrot: { ripe: 4, icon: 5 },
  rice: { ripe: 5, icon: 6 },
  corn: { ripe: 5, icon: 6 },
  pumpkin: { ripe: 4, icon: 5 },
  potato: { ripe: 4, icon: 5 },
  chili: { ripe: 5, icon: 6 },
  strawberry: { ripe: 4, icon: 5 },
  pineapple: { ripe: 2, icon: 3 },
  watermelon: { ripe: 4, icon: 5 },
  grape: { ripe: 5, icon: 6 },
  mango: { ripe: 4, icon: 5 },
  dragonFruit: { ripe: 5, icon: 6 },
  rose: { ripe: 4, icon: 5 },
  sunflower: { ripe: 4, icon: 5 },
  tulip: { ripe: 4 },
  cosmos: { ripe: 4, icon: 5 },
  lotus: { ripe: 4 },
  aloe: { ripe: 4, icon: 5 },
};

/** Growing frame for the elapsed share of the grow time; the ripe plant appears only once ripe. */
export function cropGrowthFrame(id: CropId, fraction: number) {
  const { ripe } = CROP_GROWTH_FRAMES[id];
  return Math.min(ripe - 1, Math.floor(Math.max(0, fraction) * ripe));
}

export function cropIconName(id: CropId) {
  return `crop-${id}-icon`;
}

export function cropAssetName(id: CropId, frame: number) {
  return `crop-${id}-stage-${frame}`;
}

export function cropIconUrl(id: CropId) {
  return farmAssetUrl(cropIconName(id));
}
