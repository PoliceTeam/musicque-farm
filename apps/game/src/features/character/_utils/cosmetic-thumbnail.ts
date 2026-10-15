import type { DrawOp, Recolor } from '@chibi-town/character-core/character-types';
import {
  COSMETIC_CATALOG,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { colors, items, pets } from '@chibi-town/character-core/item-catalog';
import { defaultOutfit, femaleOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';
import { petSheet, sheet } from '@/assets/asset-catalog';

/** Reuse existing approved sprites. No renderer scenes, new artwork, or per-card animation clocks. */
export function cosmeticThumbnailModel(definition: Readonly<CosmeticDefinition>, colorUnlockId?: string) {
  if (definition.kind === 'pet') {
    const pet = pets[definition.petId];
    return { sheet: petSheet, ops: [{ piece: pet.piece, recolor: pet.recolor, x: 0, y: 0, flip: false }] };
  }
  const preset = 'gender' in definition && definition.gender === 'female' ? femaleOutfit : defaultOutfit;
  const recolor: Recolor = {};
  for (const field of outfitFields) if (field.colors) Object.assign(recolor, colors[field.colors][preset[field.key]]);
  const ownedColor =
    colorUnlockId && Object.hasOwn(COSMETIC_CATALOG, colorUnlockId)
      ? COSMETIC_CATALOG[colorUnlockId as CosmeticId]
      : undefined;
  if (definition.kind === 'skin-color' || definition.kind === 'item-color')
    Object.assign(recolor, colors[definition.colorGroup][definition.colorValue]);
  else if (ownedColor?.kind === 'item-color' && ownedColor.itemId === definition.itemId)
    Object.assign(recolor, colors[ownedColor.colorGroup][ownedColor.colorValue]);
  const ids =
    definition.kind === 'skin-color'
      ? ['head', 'eyes.big']
      : [...(items[`${definition.itemId}.back`] ? [`${definition.itemId}.back`] : []), definition.itemId];
  const ops: DrawOp[] = ids.map((id) => {
    const pose = items[id].poses[0];
    return { piece: pose.piece, recolor, x: pose.dx, y: pose.dy, flip: false };
  });
  return { sheet, ops };
}

/** Frame visible pixels rather than source padding, so small accessories and wide wings stay legible. */
export function cosmeticThumbnailBounds(source: SpriteSheet, ops: DrawOp[]) {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const op of ops) {
    const piece = source.pieces[op.piece];
    for (let y = 0; y < piece.rows.length; y++) {
      for (let x = 0; x < piece.rows[y].length; x++) {
        if (piece.rows[y][x] === '.') continue;
        left = Math.min(left, op.x + x);
        top = Math.min(top, op.y + y);
        right = Math.max(right, op.x + x + 1);
        bottom = Math.max(bottom, op.y + y + 1);
      }
    }
  }
  return { left, top, width: right - left, height: bottom - top };
}
