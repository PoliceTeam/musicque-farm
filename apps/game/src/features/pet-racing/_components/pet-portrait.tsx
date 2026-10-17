import { pets } from '@chibi-town/character-core/item-catalog';
import { useEffect, useRef } from 'react';
import { petSheet } from '@/assets/asset-catalog';
import { drawSprite, PieceCache } from '@/game/rendering/canvas-renderer';

export function PetPortrait({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const cache = new PieceCache(petSheet);
    const piece = pets[id].piece;
    const size = cache.size(piece);
    canvas.width = (size.width + 12) * 2;
    canvas.height = (size.height + 12) * 2;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.scale(2, 2);
    drawSprite(g, cache.get(piece), 6, 6, size.width);
  }, [id]);
  return <canvas ref={ref} role="img" aria-label={pets[id].label} />;
}
