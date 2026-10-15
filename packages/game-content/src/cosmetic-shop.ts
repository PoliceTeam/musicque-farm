/** Initial economy values, shared by local and server; the client never supplies a purchase price. */
export const COSMETIC_SHOP_PRICES = {
  equipment: 2_000,
  appearance: 1_500,
  pet: 5_000,
  color: 500,
  skin: 1_000,
} as const;
export const CHARACTER_BAG_SLOTS = 24;
