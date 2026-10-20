import type { Outfit } from '@chibi-town/character-core/character-types';
import { COSMETIC_CATALOG, type CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { COSMETIC_INDEX } from '@chibi-town/character-core/cosmetic-index';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';

/** Preserve the selected item's dye when comparing its current and next-level appearances. */
export function upgradePreview(outfit: Outfit, target: Readonly<CosmeticDefinition>, sourceColor?: string) {
  const color = sourceColor ? COSMETIC_CATALOG[sourceColor as keyof typeof COSMETIC_CATALOG] : undefined;
  if (color?.kind === 'item-color') {
    const palette = COSMETIC_INDEX.select({ groupId: target.groupId }).find(
      (entry) => entry.kind === 'item-color' && entry.requires === target.id && entry.colorId === color.colorId,
    );
    if (palette) return previewCosmetic(outfit, palette);
  }
  return previewCosmetic(outfit, target);
}
