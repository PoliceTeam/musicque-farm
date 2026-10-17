import type { Outfit } from '@chibi-town/character-core/character-types';
import type { GameSdk } from '@chibi-town/contracts';
import { CurrencyIcon } from '@chibi-town/ui/react';
import { useTranslation } from 'react-i18next';
import { CharacterPreview } from '@/features/character/_components/character-preview';
import { CharacterStatIcon } from '@/features/character/_components/character-stat-icon';

export function CharacterProfile({
  player,
  outfit,
  coins,
  gems,
}: {
  player?: Awaited<ReturnType<GameSdk['getPlayer']>>;
  outfit?: Outfit;
  coins?: number;
  gems?: number;
}) {
  const { t } = useTranslation('inventory');
  return (
    <div className="character-profile">
      <section className="character-identity" aria-label={player?.name ?? t('character.information')}>
        <div className="character-identity-heading">
          <strong>{player?.name ?? '…'}</strong>
          <span className="character-level-badge">{t('character.profileLevel', { level: player?.level ?? '…' })}</span>
        </div>
        <div className="character-avatar-stage">
          {player && <CharacterPreview outfit={outfit ?? player.outfit} label={player.name} />}
        </div>
        <dl className="character-wallet">
          {(['coins', 'gems'] as const).map((kind) => (
            <div key={kind}>
              <dt>
                <CurrencyIcon kind={kind} />
                <span>{t(`character.${kind}`)}</span>
              </dt>
              <dd>{(kind === 'coins' ? coins : gems)?.toLocaleString('vi-VN') ?? '…'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="character-attributes" aria-label={t('character.attributes')}>
        <h3>{t('character.attributes')}</h3>
        <dl className="character-stat-cards">
          {(['experience', 'fashion', 'friendliness', 'happiness', 'mischief', 'health'] as const).map((key) => (
            <div key={key} className={`character-stat-card stat-${key}`}>
              <dt>
                <span className="character-stat-icon">
                  <CharacterStatIcon kind={key} />
                </span>
                <span>{t(`character.stats.${key}`)}</span>
              </dt>
              <dd>{player?.stats?.[key].toLocaleString('vi-VN') ?? '…'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
