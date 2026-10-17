import { RACE_PETS, type RaceResult, type RaceRound } from '@chibi-town/contracts/pet-racing';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useTranslation } from 'react-i18next';
import { PetPortrait } from '@/features/pet-racing/_components/pet-portrait';
import { RaceSettlementSummary } from '@/features/pet-racing/_components/race-settlement-summary';
import { RaceVictory } from '@/features/pet-racing/_components/race-victory';

export function RaceResultDialog({
  round,
  result,
  now,
  onClose,
  celebrate = false,
}: {
  round: RaceRound;
  result?: RaceResult;
  now: number;
  onClose(): void;
  celebrate?: boolean;
}) {
  const { t } = useTranslation('common');
  const winner = result?.winner ?? round.winner!;
  const finishTimes = result?.finishTimes ?? round.finishTimes!;
  const showingCurrent = !result || result.roundId === round.id;
  return (
    <Dialog
      title={t('petRace.results')}
      className={`pet-race-result-dialog${result?.pet === result?.winner && result ? ' pet-race-result-win' : ''}`}
      onClose={onClose}
      closeLabel={t('close')}
      footer={<Button onClick={onClose}>{t('petRace.watchTrack')}</Button>}
    >
      {result && <RaceVictory result={result} celebrate={celebrate} />}
      {result ? (
        <RaceSettlementSummary result={result} />
      ) : (
        <p role="status">{t('petRace.winner', { pet: t(`petRace.pets.${RACE_PETS[winner].id}`) })}</p>
      )}
      {result && (
        <p className="pet-race-rules">
          {t('petRace.receiptWinner', { pet: t(`petRace.pets.${RACE_PETS[winner].id}`) })}
        </p>
      )}
      <ol className="pet-race-rankings">
        {finishTimes
          .map((time, lane) => ({ time, lane }))
          .sort((a, b) => a.time - b.time || a.lane - b.lane)
          .map(({ time, lane }) => (
            <li key={lane} data-selected={lane === result?.pet}>
              <PetPortrait id={RACE_PETS[lane].id} />
              <span>
                {t(`petRace.pets.${RACE_PETS[lane].id}`)}
                {lane === result?.pet && <small>{t('petRace.yourPet')}</small>}
              </span>
              <strong>
                {t('petRace.finishTime', {
                  time: (time / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
              </strong>
            </li>
          ))}
      </ol>
      {showingCurrent && now < round.nextRoundAt && (
        <p>{t('petRace.nextRoundCountdown', { count: Math.max(0, Math.ceil((round.nextRoundAt - now) / 1000)) })}</p>
      )}
    </Dialog>
  );
}
