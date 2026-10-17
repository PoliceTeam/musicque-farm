/** Initial economy values, shared by local and server; the client never supplies a purchase price. */
export const COSMETIC_SHOP_PRICES = {
  equipment: 40_000,
  appearance: 25_000,
  pet: 80_000,
  color: 12_000,
  skin: 30_000,
} as const;
export const COSMETIC_SLOT_PRICES: Readonly<Record<string, number>> = {
  hair: 35_000,
  head: 25_000,
  eyes: 18_000,
  mouth: 10_000,
  nose: 8_000,
  sticker: 12_000,
};
export const PREMIUM_SLOT_PRICES: Readonly<Record<string, number>> = {
  hair: 200_000,
  shirt: 180_000,
  pants: 140_000,
  shoes: 100_000,
  wrist: 60_000,
};
export const PREMIUM_COSMETIC_GROUPS = [
  'item/hair.goku',
  'item/shirt.goku',
  'item/pants.goku',
  'item/shoes.goku',
  'item/wrist.goku',
] as const;
export const PREMIUM_COLOR_PRICE = 35_000;
export const COSMETIC_SHOP_IDS = ['salon', 'premium', 'fashion', 'accessories', 'pets'] as const;
export type CosmeticShopId = (typeof COSMETIC_SHOP_IDS)[number];
export const CHARACTER_BAG_SLOTS = 24;
