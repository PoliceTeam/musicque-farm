import { FARM_PRODUCTS } from '@chibi-town/game-content/farm-balance';
import { chestUpgradePrice, type FarmChest } from '@chibi-town/game-content/farm-upgrade-catalog';
import type { FarmProgress } from './farm-crop-logic.js';
import type { FarmProduct } from './farm-product-logic.js';

export const FARM_CHEST_SLOTS = [12, 18, 24, 30, 36, 48] as const;
export type ChestLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function chestInventory(state: FarmProgress, chest: FarmChest) {
  return chest === 'main' ? state.inventory : state.homeInventory;
}

export function chestSlots(state: FarmProgress, chest: FarmChest) {
  return FARM_CHEST_SLOTS[state.chests[chest] - 1];
}

export function occupiedChestSlots(state: FarmProgress, chest: FarmChest) {
  return Object.entries(chestInventory(state, chest)).filter(
    ([id, count]) => Object.hasOwn(FARM_PRODUCTS, id) && count && count > 0,
  ).length;
}

/** Seeds use the separate seed warehouse, including legacy inventory.seed. */
export function canStoreFarmGoods(
  state: FarmProgress,
  additions: Partial<Record<FarmProduct, number>>,
  chest: FarmChest = 'main',
) {
  const stock = chestInventory(state, chest);
  const entries = Object.entries(additions) as [FarmProduct, number][];
  if (
    entries.some(
      ([id, count]) =>
        !Object.hasOwn(FARM_PRODUCTS, id) ||
        !Number.isSafeInteger(count) ||
        count < 1 ||
        !Number.isSafeInteger((stock[id] ?? 0) + count),
    )
  )
    return false;
  const newTypes = entries.filter(([id]) => (stock[id] ?? 0) === 0).length;
  // Legacy stock may exceed capacity: allow stacking existing types, never discard goods.
  return newTypes === 0 || occupiedChestSlots(state, chest) + newTypes <= chestSlots(state, chest);
}

export function upgradeFarmChest(state: FarmProgress, chest: FarmChest) {
  const price = chestUpgradePrice(chest, state.chests[chest]);
  if (!price || state[price.currency] < price.amount) return false;
  state[price.currency] -= price.amount;
  state.chests[chest] = (state.chests[chest] + 1) as ChestLevel;
  return true;
}

export function transferFarmGoods(state: FarmProgress, from: FarmChest, product: FarmProduct, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || !Object.hasOwn(FARM_PRODUCTS, product)) return false;
  const source = chestInventory(state, from);
  const to = from === 'main' ? 'home' : 'main';
  if ((source[product] ?? 0) < count || !canStoreFarmGoods(state, { [product]: count }, to)) return false;
  source[product] = (source[product] ?? 0) - count;
  const target = chestInventory(state, to);
  target[product] = (target[product] ?? 0) + count;
  return true;
}

export function parseChestLevel(value: unknown): ChestLevel {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6 ? (value as ChestLevel) : 1;
}
