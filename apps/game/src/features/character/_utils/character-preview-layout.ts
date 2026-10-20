import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip, wornPet } from '@chibi-town/character-core/outfit-logic';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { cosmeticThumbnailBounds } from '@/features/character/_utils/cosmetic-thumbnail';

/** Keep companions clear of the outfit silhouette and fit both into the preview camera. */
export function characterPreviewLayout(outfit: Outfit) {
  const ops = layoutAvatar(items, sheet, toEquip(outfit), 0, false);
  const avatar = cosmeticThumbnailBounds(sheet, ops);
  const pet = wornPet(outfit);
  if (!pet) return { ops, avatar, camera: { x: 160, y: 240, scale: 2.4 } };
  const piece = petSheet.pieces[pet.piece];
  const scale = 0.8;
  const x = Math.min(-38, avatar.left - 6 - (piece.width * scale) / 2);
  const y = -(pet.fly ?? 0);
  const left = Math.min(avatar.left, x - (piece.width * scale) / 2);
  const right = Math.max(avatar.left + avatar.width, x + (piece.width * scale) / 2);
  const top = Math.min(avatar.top, y - piece.rows.length * scale);
  const bottom = Math.max(avatar.top + avatar.height, y);
  const zoom = Math.min(2.4, 296 / (right - left), 296 / (bottom - top));
  return {
    ops,
    avatar,
    pet: { definition: pet, x, y, scale, width: piece.width, height: piece.rows.length },
    camera: {
      x: 160 - ((left + right) / 2) * zoom,
      y: Math.min(308 - bottom * zoom, Math.max(12 - top * zoom, 240)),
      scale: zoom,
    },
  };
}
