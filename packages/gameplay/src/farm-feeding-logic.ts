import { FARM_FOOD_MS } from '@chibi-town/game-content/farm-balance';

export { FARM_FOOD_MS } from '@chibi-town/game-content/farm-balance';

import type { FarmProgress } from './farm-crop-logic.js';
import { advanceFarmAnimals } from './farm-product-logic.js';
import { type FarmUnit, farmUnitAnimals } from './farm-unit-logic.js';

export function farmFoodPercent(state: FarmProgress, unit: FarmUnit, now: number) {
  const fed = state.fedAt[unit];
  return fed === null ? 0 : Math.max(0, Math.min(100, Math.ceil(100 * (1 - Math.max(0, now - fed) / FARM_FOOD_MS))));
}

export function farmFeedPrice(unit: FarmUnit) {
  return unit === 'livestock' ? 50 : 25;
}

export function feedFarmUnit(state: FarmProgress, unit: FarmUnit, now: number) {
  if (
    !farmUnitAnimals(state, unit).length ||
    !Number.isFinite(now) ||
    now < 0 ||
    farmFoodPercent(state, unit, now) > 25 ||
    state.coins < farmFeedPrice(unit)
  )
    return false;
  advanceFarmAnimals(state, now);
  state.coins -= farmFeedPrice(unit);
  state.fedAt[unit] = now;
  return true;
}

/** Approach food, eat briefly, then smoothly resume roaming. */
export function farmFeedingBlend(fedAt: number | null, now: number) {
  if (fedAt === null) return 0;
  const age = now - fedAt;
  if (age < 0 || age >= 20000) return 0;
  const t = Math.min(1, age / 3000, (20000 - age) / 3000);
  return t * t * (3 - 2 * t);
}
