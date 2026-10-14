import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import type { FarmProgress } from './farm-crop-logic.js';
import { sellFarmItem } from './farm-product-logic.js';

export function buyFarmSeeds(state: FarmProgress, count: number, cropId: CropId = 'strawberry') {
  if (!Object.hasOwn(FARM_CROPS, cropId) || !Number.isSafeInteger(count) || count < 1) return false;
  const crop = FARM_CROPS[cropId];
  const total = count * crop.seedPrice;
  const quantity = (cropId === 'strawberry' ? state.inventory.seed : (state.seeds[cropId] ?? 0)) + count;
  if (!Number.isSafeInteger(total) || state[crop.currency] < total || !Number.isSafeInteger(quantity)) return false;
  state[crop.currency] -= total;
  if (cropId === 'strawberry') state.inventory.seed = quantity;
  else state.seeds[cropId] = quantity;
  return true;
}

/** Selling is always an explicit command, independent from harvesting. */
export function sellFarmProduce(state: FarmProgress, count: number) {
  return sellFarmItem(state, 'strawberry', count);
}
