import type { Snapshot } from '@chibi-town/api-sdk';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { cropStage } from '@chibi-town/gameplay/farm-crop-logic';
import { farmFeedPrice, farmFoodPercent } from '@chibi-town/gameplay/farm-feeding-logic';
import { FARM_UNITS, readyFarmAnimals } from '@chibi-town/gameplay/farm-product-logic';
import { farmUnitAnimals } from '@chibi-town/gameplay/farm-unit-logic';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FarmCropSelector } from '@/features/farm/_components/farm-crop-selector';
import type { ExecuteFarm } from '@/features/farm/_components/farm-unit-panel';

export function FarmBatchDialog({
  snapshot,
  pending,
  execute,
  onClose,
}: {
  snapshot?: Snapshot;
  pending: boolean;
  execute: ExecuteFarm;
  onClose: () => void;
}) {
  const { t: common } = useTranslation('common');
  const { t, i18n } = useTranslation('farm');
  const state = snapshot?.farm;
  const [cropId, setCropId] = useState<CropId>('tomato');
  const definition = FARM_CROPS[cropId];
  const seedCount = state ? (cropId === 'strawberry' ? state.inventory.seed : (state.seeds[cropId] ?? 0)) : 0;
  const now = snapshot?.serverTime ?? 0;
  const feeding = state
    ? FARM_UNITS.filter((unit) => farmUnitAnimals(state, unit).length && farmFoodPercent(state, unit, now) <= 25)
    : [];
  const feedPrice = feeding.reduce((sum, unit) => sum + farmFeedPrice(unit), 0);
  const water = state?.plots.slice(0, state.owned).filter((crop) => cropStage(crop, now) === 'seeded').length ?? 0;
  const harvest = state?.plots.slice(0, state.owned).filter((crop) => cropStage(crop, now) === 'ripe').length ?? 0;
  const animals = state ? FARM_UNITS.reduce((sum, unit) => sum + readyFarmAnimals(state, unit).length, 0) : 0;
  const emptyPlots =
    state?.plots.slice(0, state.owned).filter((crop) => ['dry', 'tilled'].includes(cropStage(crop, now))).length ?? 0;
  const sowPrice = Math.max(0, emptyPlots - seedCount) * definition.seedPrice;
  const canSow =
    emptyPlots > 0 && Boolean(state && (seedCount > 0 || state[definition.currency] >= definition.seedPrice));
  const actions = [
    {
      id: 'feed',
      label: t('feedAll'),
      detail: t('quickFeedDetail', { count: feeding.length, price: feedPrice.toLocaleString(i18n.language) }),
      enabled: feeding.length > 0 && Boolean(state && state.coins >= feedPrice),
      command: { type: 'feed-all' } as const,
    },
    {
      id: 'water',
      label: t('quickWater'),
      detail: t('quickPlots', { count: water }),
      enabled: water > 0,
      command: { type: 'batch', action: 'water' } as const,
    },
    {
      id: 'harvest',
      label: t('quickHarvest'),
      detail: t('quickPlots', { count: harvest }),
      enabled: harvest > 0,
      command: { type: 'batch', action: 'harvest' } as const,
    },
    {
      id: 'animals',
      label: t('quickCollectAnimals'),
      detail: t('quickAnimals', { count: animals }),
      enabled: animals > 0,
      command: { type: 'collect-all' } as const,
    },
  ];
  return (
    <Dialog
      id="batch"
      title={t('batch')}
      onClose={onClose}
      closeLabel={common('close')}
      footer={
        <>
          <Button
            variant="primary"
            disabled={pending || !canSow}
            onClick={() => void execute({ type: 'batch', action: 'sow', cropId })}
          >
            {t('quickSow')}
          </Button>
          <Button onClick={onClose}>{common('close')}</Button>
        </>
      }
    >
      <section className="ui-section">
        <FarmCropSelector value={cropId} onChange={setCropId} />
        <p>
          {t('quickSowInfo', {
            count: emptyPlots,
            price: sowPrice.toLocaleString(i18n.language),
            currency: t(definition.currency),
          })}
        </p>
      </section>
      <div className="farm-quick-actions">
        {actions.map((action) => (
          <Button key={action.id} disabled={pending || !action.enabled} onClick={() => void execute(action.command)}>
            <strong>{action.label}</strong>
            <span>{action.detail}</span>
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
