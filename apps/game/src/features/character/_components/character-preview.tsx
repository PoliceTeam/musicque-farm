import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip, wornPet } from '@chibi-town/character-core/outfit-logic';
import { useEffect, useRef } from 'react';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { characterPreviewCss } from '@/assets/generated-styles';
import { drawOps, PieceCache } from '@/game/rendering/canvas-renderer';

/** Shared circular preview with a fixed camera and foot anchor across outfit changes. */
export function CharacterPreview({ outfit, label }: { outfit: Outfit; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const ops = layoutAvatar(items, sheet, toEquip(outfit), 0, false);
    context.clearRect(0, 0, 640, 640);
    context.save();
    context.imageSmoothingEnabled = false;
    // Keep the same scale and foot anchor when hair or equipment changes.
    context.scale(2, 2);
    context.translate(160, 240);
    context.scale(2.4, 2.4);
    const pet = wornPet(outfit);
    if (pet) {
      const piece = petSheet.pieces[pet.piece];
      context.save();
      context.translate(-38, -(pet.fly ?? 0));
      context.scale(0.8, 0.8);
      drawOps(
        context,
        new PieceCache(petSheet),
        [{ piece: pet.piece, x: -piece.width / 2, y: -piece.rows.length, flip: false, recolor: pet.recolor }],
        0,
        0,
      );
      context.restore();
    }
    drawOps(context, new PieceCache(sheet), ops, 0, 0);
    context.restore();
  }, [outfit]);
  return (
    <div className="character-preview-frame">
      <style>{characterPreviewCss}</style>
      <canvas ref={ref} width={640} height={640} role="img" aria-label={label} />
    </div>
  );
}
