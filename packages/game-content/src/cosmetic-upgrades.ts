/** Initial coin costs for unlocking the next existing catalog level. Success is guaranteed. */
export const COSMETIC_UPGRADE_COSTS: Readonly<Record<number, number>> = {
  2: 25_000,
  3: 60_000,
  4: 120_000,
  5: 220_000,
  6: 360_000,
};
export const PREMIUM_UPGRADE_MULTIPLIER = 2;
export const PET_UPGRADE_MULTIPLIER = 2;
