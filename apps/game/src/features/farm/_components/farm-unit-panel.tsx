import type { Snapshot } from '@chibi-town/api-sdk';
import { type FarmUnit, farmFeedPrice, farmFoodPercent, farmUnitAnimals, readyFarmAnimals } from '@chibi-town/gameplay';
import { Button, EmptyState, Meter } from '@chibi-town/ui/react';
import { useTranslation } from 'react-i18next';
import type { FarmCommand } from '@/features/farm/farm-store';
export type ExecuteFarm = (
  command: FarmCommand,
  confirm?: { price: number; title: string; currency?: 'coins' | 'gems' },
) => Promise<void>;

export function FarmUnitPanel({
  snapshot,
  unit,
  pending,
  execute,
}: {
  snapshot: Snapshot;
  unit: FarmUnit;
  pending: boolean;
  execute: ExecuteFarm;
}) {
  const { t } = useTranslation('farm');
  const state = snapshot.farm;
  const animals = farmUnitAnimals(state, unit);
  const food = farmFoodPercent(state, unit, snapshot.serverTime);
  const ready = readyFarmAnimals(state, unit).length;
  return (
    <div className="ui-stack">
      {animals.length > 0 && (
        <section className="ui-section">
          <p>{t('capacity', { count: animals.length, capacity: state.capacity[unit], ready })}</p>
          <Meter label={t('food')} value={food} />
          <div className="warehouse-actions">
            <Button
              disabled={pending || !animals.length || food > 25 || state.coins < farmFeedPrice(unit)}
              onClick={() => void execute({ type: 'feed', unit })}
            >
              {t('feed', { coins: farmFeedPrice(unit) })}
            </Button>
            <Button
              variant="primary"
              disabled={pending || !ready}
              onClick={() => void execute({ type: 'collect', unit })}
            >
              {t('collect')}
            </Button>
          </div>
          {food === 0 && animals.length > ready && <p>{t('growthPaused')}</p>}
        </section>
      )}
      {!animals.length && <EmptyState title={t('emptyAnimals')} />}
    </div>
  );
}
