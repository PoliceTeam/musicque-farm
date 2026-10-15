import type { Outfit } from '@chibi-town/character-core/character-types';
import {
  COSMETIC_COLOR_IDS,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { families, itemAtLevel, items, petAtLevel } from '@chibi-town/character-core/item-catalog';
import { defaultOutfit, femaleOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';

export type Binding = { cosmeticId: CosmeticId; slot: string; colorUnlockId?: `item-color/${string}/${string}` };

export function bindings(outfit: Outfit): Binding[] {
  const result: Binding[] = [];
  for (const field of outfitFields) {
    if (field.slot && outfit[field.key]) {
      const selected = outfit[field.key];
      const levelField = outfitFields.find((f) => f.levelOf === field.key);
      const level = levelField ? Number(outfit[levelField.key]) : 1;
      const itemId = families[selected] ? itemAtLevel(selected, level) : selected;
      const item = itemId && items[itemId];
      if (
        !item ||
        item.hidden ||
        item.slot !== field.slot ||
        (item.gender && item.gender !== outfit.gender) ||
        (families[selected] && item.level !== level)
      )
        throw new ApiSdkError('NOT_ALLOWED');
      const colorField = outfitFields.find((f) => f.colors === field.slot);
      let colorUnlockId: Binding['colorUnlockId'];
      if (colorField) {
        const colorId = COSMETIC_COLOR_IDS[field.slot]?.[outfit[colorField.key]];
        if (!colorId) throw new ApiSdkError('NOT_ALLOWED');
        colorUnlockId = `item-color/${item.id}/${colorId}`;
      }
      result.push({ cosmeticId: `item/${item.id}`, slot: field.key, colorUnlockId });
    }
  }
  if (outfit.pet) {
    const pet = petAtLevel(outfit.pet, Number(outfit.petLevel));
    if (!pet || (pet.level ?? 1) !== Number(outfit.petLevel)) throw new ApiSdkError('NOT_ALLOWED');
    result.push({ cosmeticId: `pet/${pet.id}`, slot: 'pet' });
  }
  return result;
}

export function skinId(outfit: Outfit): CosmeticId {
  return `skin-color/${COSMETIC_COLOR_IDS.skin[outfit.skin]}`;
}

export function initialColor(entry: Readonly<CosmeticDefinition>): CosmeticId | undefined {
  if (entry.kind !== 'item') return undefined;
  const preset = entry.gender === 'female' ? femaleOutfit : defaultOutfit;
  const field = outfitFields.find((f) => f.colors === entry.slot);
  if (!field) return undefined;
  return `item-color/${entry.itemId}/${COSMETIC_COLOR_IDS[entry.slot][preset[field.key]]}`;
}
