import type { CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cosmeticThumbnailBounds, cosmeticThumbnailModel } from '@/features/character/_utils/cosmetic-thumbnail';
import { drawOps, PieceCache } from '@/game/rendering/canvas-renderer';

export function CosmeticThumbnail({
  definition,
  colorUnlockId,
}: {
  definition: Readonly<CosmeticDefinition>;
  colorUnlockId?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { t } = useTranslation('inventory');
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const model = cosmeticThumbnailModel(definition, colorUnlockId);
    const bounds = cosmeticThumbnailBounds(model.sheet, model.ops);
    const scale = Math.min(112 / bounds.width, 96 / bounds.height, 4);
    context.clearRect(0, 0, 256, 224);
    context.save();
    context.imageSmoothingEnabled = false;
    context.scale(2, 2);
    context.translate((128 - bounds.width * scale) / 2, (112 - bounds.height * scale) / 2);
    context.scale(scale, scale);
    drawOps(context, new PieceCache(model.sheet), model.ops, -bounds.left, -bounds.top);
    context.restore();
  }, [definition, colorUnlockId]);
  return (
    <canvas
      className="cosmetic-thumbnail"
      ref={canvas}
      width={256}
      height={224}
      role="img"
      aria-label={t('character.thumbnail', { name: definition.label })}
    />
  );
}
