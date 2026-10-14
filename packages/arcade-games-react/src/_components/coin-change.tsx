import type { createGameAudio } from '@chibi-town/game-audio';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function CoinChange({ coins, audio }: { coins: number; audio: ReturnType<typeof createGameAudio> }) {
  const previous = useRef(coins);
  const [change, setChange] = useState<{ delta: number; key: number }>();
  const { t } = useTranslation('common');
  useEffect(() => {
    const delta = coins - previous.current;
    previous.current = coins;
    if (!delta) return;
    setChange({ delta, key: Date.now() });
    audio.play(delta > 0 ? 'coins-up' : 'coins-down');
    const timer = setTimeout(() => setChange(undefined), 2400);
    return () => clearTimeout(timer);
  }, [coins, audio]);
  return change ? (
    <div key={change.key} className={`arcade-coin-change ${change.delta > 0 ? 'is-gain' : 'is-loss'}`} role="status">
      {t('arcadeCoinChange', {
        sign: change.delta > 0 ? '+' : '−',
        coins: Math.abs(change.delta).toLocaleString('vi-VN'),
      })}
    </div>
  ) : null;
}
