import type { RecipeId } from '@chibi-town/game-content/farm-recipes';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';

export const DESSERT_REFERENCE_IDS: Partial<Record<RecipeId, true>> = {
  starfruitYogurt: true,
  fruitMilkTea: true,
  sweetSoup: true,
  peachTea: true,
  friedIceCream: true,
};

export const REFERENCE_FOOD_IDS: Partial<Record<RecipeId, true>> = {
  ...DESSERT_REFERENCE_IDS,
  riceMeal: true,
  eggCake: true,
  milkCake: true,
  eggRice: true,
  carrotRice: true,
  pancake: true,
  pizza: true,
  fries: true,
  butterCorn: true,
  beefBalls: true,
  fishBalls: true,
  cheese: true,
  mangoSalad: true,
  fruitJuice: true,
  watermelonJuice: true,
  ketchup: true,
  chiliSauce: true,
};

/** Supplied artwork shared by the kitchen and harvested stock. */
export function foodIconUrl(id: RecipeId): string {
  return farmAssetUrl(`food-${id}`);
}
