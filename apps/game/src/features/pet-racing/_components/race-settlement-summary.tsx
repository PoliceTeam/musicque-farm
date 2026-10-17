import { RACE_PETS, type RaceResult } from '@chibi-town/contracts/pet-racing';
import { useTranslation } from 'react-i18next';
import { raceSettlementAmounts } from '@/features/pet-racing/_utils/race-logic';

export function RaceSettlementSummary({ result }: { result: RaceResult }) {
  const { t } = useTranslation('common');
  const amounts = raceSettlementAmounts(result);

  const signed = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('vi-VN')}`;

  return (
    <div className="pet-race-settlement" role="status">
      <p>
        <strong>{t(result.pet === result.winner ? 'petRace.receiptWin' : 'petRace.receiptLoss')}</strong>
        {' · '}
        {t('petRace.receiptRound', {
          round: result.roundId.slice(5),
          pet: t(`petRace.pets.${RACE_PETS[result.pet].id}`),
        })}
      </p>
      <dl className="pet-race-money">
        <div>
          <dt>{t('petRace.debit')}</dt>
          <dd>{t('petRace.coinAmount', { amount: `−${amounts.debited.toLocaleString('vi-VN')}` })}</dd>
        </div>
        <div>
          <dt>{t('petRace.credit')}</dt>
          <dd>{t('petRace.coinAmount', { amount: signed(amounts.credited) })}</dd>
        </div>
        <div data-outcome={amounts.net >= 0 ? 'win' : 'loss'}>
          <dt>{t('petRace.net')}</dt>
          <dd>{t('petRace.coinAmount', { amount: signed(amounts.net) })}</dd>
        </div>
      </dl>
    </div>
  );
}
