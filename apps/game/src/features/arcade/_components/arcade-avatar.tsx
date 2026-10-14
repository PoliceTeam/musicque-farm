import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import { useEffect, useRef } from 'react';
import { sheet } from '@/assets/asset-catalog';
import { FigureCache, PieceCache } from '@/game/rendering/canvas-renderer';

/** Frame the existing approved sprites; no new character artwork or palette changes. */
export function ArcadeAvatar({ outfit, mirror = false, label }: { outfit: Outfit; mirror?: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = 192;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(3, 3);
    new FigureCache(new PieceCache(sheet)).draw(ctx, layoutAvatar(items, sheet, toEquip(outfit), 0, mirror), 32, 72);
  }, [outfit, mirror]);
  return <canvas ref={ref} role="img" aria-label={label} />;
}
