/** Business categories are independent from rendering layers and acquisition sources. */
export type CosmeticCategory = 'equipment' | 'appearance' | 'pet';

/** New public slots must be classified explicitly; hidden rendering helpers are excluded upstream. */
export const COSMETIC_SLOT_CATEGORIES: Readonly<Record<string, CosmeticCategory>> = Object.freeze({
  hair: 'appearance',
  head: 'appearance',
  eyes: 'appearance',
  mouth: 'appearance',
  nose: 'appearance',
  sticker: 'appearance',
  shirt: 'equipment',
  pants: 'equipment',
  shoes: 'equipment',
  wrist: 'equipment',
  mouthAcc: 'equipment',
  held: 'equipment',
  back: 'equipment',
  hat: 'equipment',
  tail: 'equipment',
});

export function cosmeticCategoryForSlot(slot: string): CosmeticCategory {
  const category = COSMETIC_SLOT_CATEGORIES[slot];
  if (!category) throw new Error(`Unclassified cosmetic slot: ${slot}`);
  return category;
}
