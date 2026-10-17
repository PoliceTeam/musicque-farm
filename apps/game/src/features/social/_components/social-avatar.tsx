import type { Outfit } from '@chibi-town/character-core/character-types';
import { useEffect, useRef } from 'react';
import { drawPlayerPortrait } from '@/game/rendering/player-portrait-view';

export function SocialAvatar({ outfit, name }: { outfit: Outfit; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPlayerPortrait(ref.current, outfit);
  }, [outfit]);
  return <canvas ref={ref} width={144} height={144} role="img" aria-label={name} />;
}
