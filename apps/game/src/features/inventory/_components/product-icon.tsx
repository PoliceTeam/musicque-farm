import type { CropId } from '@chibi-town/game-content/farm-catalog';
import { FARM_RECIPES, type RecipeId } from '@chibi-town/game-content/farm-recipes';
import { FARM_PRODUCTS, type FarmProduct } from '@chibi-town/gameplay';
import { UiImage } from '@chibi-town/ui/react';
import { CROP_GROWTH_FRAMES, cropIconUrl } from '@/features/farm/_utils/crop-growth-frames';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';
import { foodIconUrl } from '@/features/farm/_utils/food-art';

const PRODUCT_IMAGES: Partial<Record<FarmProduct, string>> = {
  beef: farmAssetUrl('food-beef'),
  pork: farmAssetUrl('pig-product-0'),
  fish: farmAssetUrl('fish-product-0'),
  egg: farmAssetUrl('hen-product-0'),
  duckEgg: farmAssetUrl('duck-product-0'),
  milk: farmAssetUrl('cow-product-0'),
  wool: farmAssetUrl('sheep-product-0'),
  ...Object.fromEntries((Object.keys(CROP_GROWTH_FRAMES) as CropId[]).map((id) => [id, cropIconUrl(id)])),
  ...Object.fromEntries((Object.keys(FARM_RECIPES) as RecipeId[]).map((id) => [id, foodIconUrl(id)])),
};

export function ProductIcon({ product }: { product: FarmProduct }) {
  const src = PRODUCT_IMAGES[product];
  if (!src) return <span aria-hidden="true">{FARM_PRODUCTS[product].icon}</span>;
  return <UiImage src={src} alt="" width={48} height={48} />;
}
