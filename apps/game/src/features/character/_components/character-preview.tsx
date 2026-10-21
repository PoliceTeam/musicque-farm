import type { Outfit } from '@chibi-town/character-core/character-types';
import { useEffect, useRef } from 'react';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { characterPreviewCss } from '@/assets/generated-styles/character-preview-css';
import { characterPreviewLayout } from '@/features/character/_utils/character-preview-layout';
import { drawOps, PieceCache } from '@/game/rendering/canvas-renderer';

/** Shared circular preview, framing the character and companion without overlap. */
export function CharacterPreview({ outfit, label }: { outfit: Outfit; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const { ops, pet, camera } = characterPreviewLayout(outfit);
    context.clearRect(0, 0, 640, 640);
    context.save();
    context.imageSmoothingEnabled = false;
    context.scale(2, 2);
    context.translate(camera.x, camera.y);
    context.scale(camera.scale, camera.scale);
    if (pet) {
      const piece = petSheet.pieces[pet.definition.piece];
      context.save();
      context.translate(pet.x, pet.y);
      context.scale(pet.scale, pet.scale);
      drawOps(
        context,
        new PieceCache(petSheet),
        [
          {
            piece: pet.definition.piece,
            x: -piece.width / 2,
            y: -piece.rows.length,
            flip: false,
            recolor: pet.definition.recolor,
          },
        ],
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
