import {
  RACE_MAX_STAKE,
  RACE_MIN_STAKE,
  RACE_PETS,
  type RaceLobby,
  racePayout,
} from '@chibi-town/contracts/pet-racing';
import { Button, CurrencyIcon, Dialog, FormField } from '@chibi-town/ui/react';
import { useTranslation } from 'react-i18next';
import { PetPortrait } from '@/features/pet-racing/_components/pet-portrait';
import { raceMultiplierLabel } from '@/features/pet-racing/_utils/race-logic';

export function RaceBetDialog({
  lobby,
  now,
  selected,
  onSelect,
  stake,
  onStake,
  busy,
  pending,
  ready,
  onSubmit,
  onClose,
}: {
  lobby: RaceLobby;
  now: number;
  selected: number;
  onSelect(value: number): void;
  stake: string;
  onStake(value: string): void;
  busy: boolean;
  pending: boolean;
  ready: boolean;
  onSubmit(): void;
  onClose(): void;
}) {
  const { t } = useTranslation('common');
  const pet = RACE_PETS[selected];
  const odds = lobby.round.odds[selected];
  const amount = Number(stake);
  const locked = busy || pending || !!lobby.bet || now >= lobby.round.startsAt;
  const validAmount = Number.isSafeInteger(amount) && amount >= RACE_MIN_STAKE && amount <= RACE_MAX_STAKE;
  const stakeError = !validAmount
    ? t('petRace.invalidStake', {
        min: RACE_MIN_STAKE.toLocaleString('vi-VN'),
        max: RACE_MAX_STAKE.toLocaleString('vi-VN'),
      })
    : amount > lobby.availableCoins
      ? t('petRace.insufficient')
      : undefined;
  const valid = !stakeError;
  return (
    <Dialog
      title={t('petRace.openBet')}
      className="pet-race-bet-dialog"
      onClose={onClose}
      closeLabel={t('close')}
      footer={
        <>
          <Button onClick={onClose}>{t('petRace.watchTrack')}</Button>
          <Button
            variant="primary"
            busy={busy}
            busyLabel={t('petRace.sending')}
            disabled={!ready || !!lobby.bet || now >= lobby.round.startsAt || (!valid && !pending)}
            onClick={onSubmit}
          >
            {t(lobby.bet ? 'petRace.betPlaced' : pending ? 'petRace.retryBet' : 'petRace.confirmBet')}
          </Button>
        </>
      }
    >
      <p className="pet-race-round-status" role="status">
        {lobby.bet
          ? t('petRace.currentBet', {
              pet: t(`petRace.pets.${RACE_PETS[lobby.bet.pet].id}`),
              amount: lobby.bet.stake.toLocaleString('vi-VN'),
              count: Math.max(0, Math.ceil((lobby.round.startsAt - now) / 1000)),
            })
          : t('petRace.bettingCountdown', { count: Math.max(0, Math.ceil((lobby.round.startsAt - now) / 1000)) })}
      </p>
      <div className="pet-race-bet-layout">
        <div className="pet-race-detail">
          <div className="pet-race-selected">
            <PetPortrait id={pet.id} />
            <h3>{t(`petRace.pets.${pet.id}`)}</h3>
          </div>
          <dl className="ui-facts">
            <dt>{t('petRace.chance')}</dt>
            <dd>{odds.chance}%</dd>
            <dt>{t('petRace.multiplier')}</dt>
            <dd>{raceMultiplierLabel(odds)}</dd>
            <dt>{t('petRace.lane')}</dt>
            <dd>{selected + 1}</dd>
          </dl>
          <FormField label={t('petRace.stake')} error={!locked ? stakeError : undefined}>
            <input
              id="race-stake"
              type="number"
              inputMode="numeric"
              min={RACE_MIN_STAKE}
              max={Math.min(RACE_MAX_STAKE, lobby.availableCoins)}
              step="1"
              value={stake}
              disabled={locked}
              onChange={(event) => onStake(event.target.value)}
            />
          </FormField>
          <div className="pet-race-amounts">
            {[100, 500, 1000].map((n) => (
              <Button
                key={n}
                aria-pressed={amount === n}
                variant={amount === n ? 'primary' : 'default'}
                disabled={locked || n > lobby.availableCoins}
                onClick={() => onStake(String(n))}
              >
                {n.toLocaleString('vi-VN')}
              </Button>
            ))}
          </div>
          <p>{t('petRace.payout', { amount: (validAmount ? racePayout(amount, odds) : 0).toLocaleString('vi-VN') })}</p>
          <span className="pet-race-wallet">
            <CurrencyIcon kind="coins" />
            {t('petRace.available', { amount: lobby.availableCoins.toLocaleString('vi-VN') })}
          </span>
        </div>
        <div className="pet-race-choices">
          {RACE_PETS.map((entry, index) => (
            <Button
              key={entry.id}
              aria-label={t('petRace.selectPet', { pet: t(`petRace.pets.${entry.id}`) })}
              aria-pressed={selected === index}
              disabled={locked}
              onClick={() => onSelect(index)}
            >
              <PetPortrait id={entry.id} />
              <span>
                <strong>{t(`petRace.pets.${entry.id}`)}</strong>
                <small>
                  {lobby.round.odds[index].chance}% · {raceMultiplierLabel(lobby.round.odds[index])}
                </small>
              </span>
            </Button>
          ))}
        </div>
      </div>
      <details className="pet-race-rules">
        <summary>{t('arcadeHelp')}</summary>
        <p>{t('petRace.rules')}</p>
      </details>
    </Dialog>
  );
}
