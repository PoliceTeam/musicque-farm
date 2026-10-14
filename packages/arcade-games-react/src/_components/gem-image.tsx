import type { Gem } from '@chibi-town/arcade-games/gem-battle-logic';
import { useUiImages } from '@chibi-town/ui/react';
import { useArcadeHost } from '../host.js';

// Visible alpha bounds from the source exports; preserve the supplied pixels.
const ART: Record<Gem, { width: number; height: number; bounds: string }> = {
  attack: { width: 125, height: 130, bounds: '0 5 116 122' },
  heal: { width: 111, height: 108, bounds: '0 0 105 106' },
  mana: { width: 118, height: 114, bounds: '0 0 113 114' },
  score: { width: 111, height: 115, bounds: '0 0 109 115' },
  shield: { width: 118, height: 110, bounds: '0 0 117 110' },
  luck: { width: 113, height: 113, bounds: '0 0 113 113' },
};

export function GemImage({ gem }: { gem: Gem }) {
  const art = ART[gem];
  const { assets } = useArcadeHost();
  const registry = useUiImages();
  const src = registry.assets[`arcade:gem-${gem}`]?.src ?? assets[`gem-${gem}`];
  return (
    <svg className="gem-image" viewBox={art.bounds} aria-hidden="true" focusable="false">
      <image href={src} width={art.width} height={art.height} />
    </svg>
  );
}
