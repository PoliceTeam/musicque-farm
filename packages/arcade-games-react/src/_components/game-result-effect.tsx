import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ArcadeResultSnapshot, newArcadeResult } from '../_utils/table-updates.js';

const particles = Array.from({ length: 32 }, (_, index) => index);

/** Visual feedback only; outcome and amounts always come from the confirmed game snapshot. */
export function GameResultEffect({ match }: { match?: ArcadeResultSnapshot }) {
  const { t } = useTranslation('common');
  const previous = useRef<ArcadeResultSnapshot | undefined>(undefined);
  const [effect, setEffect] = useState<{ outcome: 'win' | 'loss' | 'draw'; delta?: number; id: string }>();
  useEffect(() => {
    const outcome = newArcadeResult(previous.current, match);
    if (!match || match.id !== previous.current?.id || match.status === 'waiting') setEffect(undefined);
    previous.current = match;
    if (outcome && match)
      setEffect({
        outcome,
        delta: match.session?.settled ? match.session.coinDelta : undefined,
        id: `${match.id}:${Date.now()}`,
      });
  }, [match]);
  useEffect(() => {
    if (!effect) return;
    const timer = setTimeout(() => setEffect(undefined), 4200);
    return () => clearTimeout(timer);
  }, [effect]);
  if (!effect) return null;
  return (
    <div key={effect.id} className={`arcade-result-effect is-${effect.outcome}`}>
      <div className="arcade-result-particles" aria-hidden="true">
        {effect.outcome !== 'draw' &&
          particles.map((index) => (
            <i
              key={index}
              style={
                {
                  '--result-x': `${(index * 37) % 101}%`,
                  '--result-delay': `${(index % 8) * 0.07}s`,
                  '--result-drift': `${(index % 2 ? 1 : -1) * (20 + (index % 7) * 12)}px`,
                  '--result-color':
                    effect.outcome === 'win'
                      ? ['#ffdc69', '#6ce4dd', '#ff90bf', '#adf18b', '#bda5ff'][index % 5]
                      : '#b0c4e1',
                } as CSSProperties
              }
            />
          ))}
      </div>
      <div className="arcade-result-banner" role="status">
        <span aria-hidden="true">{effect.outcome === 'win' ? '✦' : effect.outcome === 'loss' ? '◆' : '＝'}</span>
        <strong>{t(`arcadeResult.${effect.outcome}`)}</strong>
        {effect.delta !== undefined && effect.delta !== 0 && (
          <small>
            {t('arcadeCoinChange', {
              sign: effect.delta > 0 ? '+' : '−',
              coins: Math.abs(effect.delta).toLocaleString('vi-VN'),
            })}
          </small>
        )}
      </div>
    </div>
  );
}
