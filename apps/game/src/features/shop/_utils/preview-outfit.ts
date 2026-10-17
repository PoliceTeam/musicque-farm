import type { Outfit } from '@chibi-town/character-core/character-types';
import { COSMETIC_CATALOG, type CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { defaultOutfit, femaleOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';

/** Preview is local only. Equipping still passes the server's ownership and palette validation. */
export function previewCosmetic(outfit: Outfit, entry: Readonly<CosmeticDefinition>): Outfit {
  const next = { ...outfit };
  if (entry.kind === 'skin-color') return { ...next, skin: entry.colorValue };
  if (entry.kind === 'pet') return { ...next, pet: entry.family ?? entry.petId, petLevel: String(entry.level ?? 1) };
  const field = outfitFields.find((value) => value.slot === entry.slot);
  if (!field) return next;
  const root = entry.kind === 'item-color' ? COSMETIC_CATALOG[entry.requires] : entry;
  if (root.kind !== 'item') return next;
  next[field.key] = root.family ?? root.itemId;
  const level = outfitFields.find((value) => value.levelOf === field.key);
  if (level) next[level.key] = String(root.level ?? 1);
  const palette = outfitFields.find((value) => value.colors === entry.slot);
  if (palette)
    next[palette.key] =
      entry.kind === 'item-color'
        ? entry.colorValue
        : (root.gender === 'female' ? femaleOutfit : defaultOutfit)[palette.key];
  return next;
}
