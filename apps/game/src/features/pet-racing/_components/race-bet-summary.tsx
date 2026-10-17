import { RACE_PETS, type RaceBet, type RaceOdds, racePayout } from '@chibi-town/contracts/pet-racing';
import { useTranslation } from 'react-i18next';

export function RaceBetSummary({ bet, odds }: { bet: RaceBet; odds: RaceOdds }) {
  const { t } = useTranslation('common');
  return (
    <section className="pet-race-bet-receipt" role="status" aria-label={t('petRace.betDetails')}>
      <strong>
        {t('petRace.confirmedPet', { pet: t(`petRace.pets.${RACE_PETS[bet.pet].id}`), lane: bet.pet + 1 })}
      </strong>
      <span>{t('petRace.stakeDebited', { amount: bet.stake.toLocaleString('vi-VN') })}</span>
      <span>{t('petRace.payout', { amount: racePayout(bet.stake, odds).toLocaleString('vi-VN') })}</span>
    </section>
  );
}
