import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { cropStage, type FarmAction, type FarmProgress, farmAction } from './farm-crop-logic.js';
import { farmFeedPrice, farmFoodPercent, feedFarmUnit } from './farm-feeding-logic.js';
import { collectFarmProducts, FARM_UNITS } from './farm-product-logic.js';
import { farmUnitAnimals } from './farm-unit-logic.js';

export function applyFarmBatch(state: FarmProgress, action: FarmAction, now: number, cropId: CropId = 'strawberry') {
  const stages = { till: 'dry', sow: 'tilled', water: 'seeded', harvest: 'ripe' } as const;
  if (action === 'buy' || !Object.hasOwn(FARM_CROPS, cropId) || !Number.isFinite(now) || now < 0)
    return { completed: 0, eligible: 0 };
  const indexes = state.plots.slice(0, state.owned).flatMap((crop, index) => {
    const stage = cropStage(crop, now);
    return stage === stages[action] || (action === 'sow' && stage === 'dry') ? [index] : [];
  });
  let completed = 0;
  for (const index of indexes) {
    const previousStage = state.plots[index].stage;
    if (action === 'sow' && previousStage === 'dry') farmAction(state, index, 'till', now, cropId);
    if (!farmAction(state, index, action, now, cropId)) {
      state.plots[index].stage = previousStage;
      break;
    }
    if (action === 'sow') farmAction(state, index, 'water', now, cropId);
    completed++;
  }
  return { completed, eligible: indexes.length };
}

/** Feeding all eligible units is atomic: never silently feed only half a farm. */
export function feedFarmHerd(state: FarmProgress, now: number) {
  if (!Number.isFinite(now) || now < 0) return 0;
  const units = FARM_UNITS.filter(
    (unit) => farmUnitAnimals(state, unit).length && farmFoodPercent(state, unit, now) <= 25,
  );
  if (state.coins < units.reduce((sum, unit) => sum + farmFeedPrice(unit), 0)) return 0;
  return units.reduce((count, unit) => count + Number(feedFarmUnit(state, unit, now)), 0);
}

export function collectFarmHerd(state: FarmProgress, now: number) {
  return FARM_UNITS.reduce((count, unit) => count + collectFarmProducts(state, unit, now), 0);
}
