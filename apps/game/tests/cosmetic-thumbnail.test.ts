import { COSMETIC_CATALOG } from '@chibi-town/character-core/cosmetic-catalog';
import { colors } from '@chibi-town/character-core/item-catalog';
import { describe, expect, it } from 'vitest';
import { cosmeticThumbnailBounds, cosmeticThumbnailModel } from '@/features/character/_utils/cosmetic-thumbnail';

describe('existing cosmetic sprite thumbnails', () => {
  it('resolves every item, pet level and palette to visible, frameable sprite pixels', () => {
    for (const definition of Object.values(COSMETIC_CATALOG)) {
      const model = cosmeticThumbnailModel(definition);
      const bounds = cosmeticThumbnailBounds(model.sheet, model.ops);
      expect(model.ops.length, definition.id).toBeGreaterThan(0);
      expect(bounds.width, definition.id).toBeGreaterThan(0);
      expect(bounds.height, definition.id).toBeGreaterThan(0);
      expect(Number.isFinite(bounds.left + bounds.top + bounds.width + bounds.height), definition.id).toBe(true);
    }
  });
  it('previews the exact offered/owned color and never leaks that color into another item', () => {
    const red = COSMETIC_CATALOG['item-color/shirt.tank/red'];
    const variant = cosmeticThumbnailModel(red);
    expect(variant.ops[0].recolor?.T).toBe(colors.shirt.Đỏ.T);
    const owned = cosmeticThumbnailModel(COSMETIC_CATALOG['item/shirt.tank'], red.id);
    expect(owned.ops[0].recolor).toEqual(variant.ops[0].recolor);
    const other = cosmeticThumbnailModel(COSMETIC_CATALOG['item/shirt.goku'], red.id);
    expect(other.ops[0].recolor?.T).not.toBe(colors.shirt.Đỏ.T);
  });
  it('includes the rear hair layer and preserves the exact pet level artwork', () => {
    const hair = cosmeticThumbnailModel(COSMETIC_CATALOG['item/hair.female-long']);
    expect(hair.ops.length).toBeGreaterThan(1);
    expect(cosmeticThumbnailModel(COSMETIC_CATALOG['pet/cat.3']).ops[0].piece).toBe('pet.cat.3');
  });
});
