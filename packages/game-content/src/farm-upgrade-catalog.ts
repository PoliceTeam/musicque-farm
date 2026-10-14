import type { FarmCurrency } from './farm-catalog.js';
import { FARM_PLOT_LIMIT } from './farm-land-config.js';

/** Exact table values: the supplied +3300 expression does not match the table. */
export function landUpgradePrice(owned: number) {
  if (!Number.isSafeInteger(owned) || owned < 6 || owned >= FARM_PLOT_LIMIT) return 0;
  return 300 * owned ** 2;
}

export function unitUpgradePrice(unit: 'livestock' | 'poultry' | 'pond', capacity: number) {
  if (!Number.isSafeInteger(capacity)) return 0;
  if (unit === 'livestock') return capacity >= 10 && capacity < 20 ? 20_000 * (capacity - 9) ** 2 : 0;
  if (unit === 'pond') return capacity >= 2 && capacity < 10 ? 50_000 * (capacity - 1) ** 2 : 0;
  return capacity >= 6 && capacity < 24 ? 200 + (capacity - 6) * 75 : 0;
}

export type FarmChest = 'main' | 'home';
export type UpgradePrice = { amount: number; currency: FarmCurrency };
/** Capacity benefits must be specified before enabling a purchase action. */
export const FARM_CHEST_UPGRADES = {
  main: {
    2: { amount: 50_000, currency: 'coins' },
    3: { amount: 100_000, currency: 'coins' },
    4: { amount: 50, currency: 'gems' },
    5: { amount: 100, currency: 'gems' },
    6: { amount: 150, currency: 'gems' },
  },
  home: {
    2: { amount: 100_000, currency: 'coins' },
    3: { amount: 200_000, currency: 'coins' },
    4: { amount: 500_000, currency: 'coins' },
    5: { amount: 200, currency: 'gems' },
    6: { amount: 500, currency: 'gems' },
  },
} as const satisfies Record<FarmChest, Record<number, UpgradePrice>>;

export function chestUpgradePrice(chest: FarmChest, currentLevel: number): UpgradePrice | null {
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 1 || currentLevel >= 6) return null;
  return FARM_CHEST_UPGRADES[chest][(currentLevel + 1) as 2 | 3 | 4 | 5 | 6];
}
