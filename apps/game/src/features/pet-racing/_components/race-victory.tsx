import { RACE_PETS, type RaceResult } from '@chibi-town/contracts/pet-racing';
import { CurrencyIcon } from '@chibi-town/ui/react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { raceSettlementAmounts } from '@/features/pet-racing/_utils/race-logic';

const confetti = Array.from({ length: 36 }, (_, index) => ({ id: `confetti-${index}`, index }));

/** Presentation uses a settled server result; it never infers a payout from the animation. */
export function RaceVictory({ result, celebrate = false }: { result: RaceResult; celebrate?: boolean }) {
  const { t } = useTranslation('common');
  if (result.pet !== result.winner) return null;
  return (
    <div className="pet-race-victory" role="status">
      {celebrate && (
        <div className="pet-race-confetti" aria-hidden="true">
          {confetti.map(({ id, index }) => (
            <i
              key={id}
              style={
                {
                  '--confetti-x': `${(index * 37) % 101}%`,
                  '--confetti-delay': `${(index % 9) * 0.08}s`,
                  '--confetti-color': ['#ffda64', '#64e4e0', '#ff8db4', '#9be67a', '#b9a1ff'][index % 5],
                  '--confetti-drift': `${(index % 2 ? 1 : -1) * (20 + (index % 7) * 9)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <span className="pet-race-victory-star" aria-hidden="true">
        ✦
      </span>
      <strong>{t('petRace.victoryTitle')}</strong>
      <span>{t('petRace.winner', { pet: t(`petRace.pets.${RACE_PETS[result.pet].id}`) })}</span>
      <span className="pet-race-victory-credit">
        <CurrencyIcon kind="coins" />
        {t('petRace.victoryCredit', { amount: raceSettlementAmounts(result).credited.toLocaleString('vi-VN') })}
      </span>
    </div>
  );
}
