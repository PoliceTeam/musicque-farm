import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import { useEffect, useRef } from 'react';
import { sheet } from '@/assets/asset-catalog';
import { cosmeticThumbnailBounds } from '@/features/character/_utils/cosmetic-thumbnail';
import { drawOps, PieceCache } from '@/game/rendering/canvas-renderer';

/** Full equipped character, framed from approved source pixels without cropping accessories. */
export function CharacterPreview({ outfit, label }: { outfit: Outfit; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const ops = layoutAvatar(items, sheet, toEquip(outfit), 0, false);
    const bounds = cosmeticThumbnailBounds(sheet, ops);
    const scale = Math.min(3, 180 / bounds.width, 100 / bounds.height);
    context.clearRect(0, 0, 640, 400);
    context.save();
    context.imageSmoothingEnabled = false;
    context.scale(2, 2);
    context.translate((320 - bounds.width * scale) / 2, (200 - bounds.height * scale) / 2);
    context.scale(scale, scale);
    drawOps(context, new PieceCache(sheet), ops, -bounds.left, -bounds.top);
    context.restore();
  }, [outfit]);
  return <canvas ref={ref} width={640} height={400} role="img" aria-label={label} />;
}
