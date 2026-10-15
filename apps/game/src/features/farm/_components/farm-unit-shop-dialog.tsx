import type { Snapshot } from '@chibi-town/api-sdk';
import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { FARM_UNIT_LIMITS, type FarmUnit, farmUnitAnimals, farmUnitPrice } from '@chibi-town/gameplay';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FarmPictureSelect } from '@/features/farm/_components/farm-picture-select';
import type { ExecuteFarm } from '@/features/farm/_components/farm-unit-panel';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';

const SPECIES: Record<FarmUnit, FarmSpecies[]> = {
  livestock: ['pig', 'cow', 'sheep', 'buffalo', 'dog'],
  poultry: ['hen', 'duck'],
  pond: ['fish', 'turtle'],
};

export function FarmUnitShopDialog({
  snapshot,
  initialUnit,
  pending,
  execute,
  onClose,
}: {
  snapshot: Snapshot;
  initialUnit: FarmUnit;
  pending: boolean;
  execute: ExecuteFarm;
  onClose: () => void;
}) {
  const { t: common } = useTranslation('common');
  const { t, i18n } = useTranslation('farm');
  const { t: inventory } = useTranslation('inventory');
  const [unit, setUnit] = useState(initialUnit);
  const [species, setSpecies] = useState<FarmSpecies>(SPECIES[initialUnit][0]);
  const state = snapshot.farm;
  const animals = farmUnitAnimals(state, unit);
  const definition = FARM_ANIMAL_CATALOG[species];
  return (
    <Dialog
      id="farm-animal-shop"
      title={t('animalShop')}
      onClose={onClose}
      closeLabel={common('close')}
      footer={
        <>
          <Button
            variant="primary"
            disabled={
              pending || animals.length >= state.capacity[unit] || state[definition.currency] < definition.price
            }
            onClick={() =>
              void execute(
                { type: 'buy-animal', unit, species },
                {
                  price: definition.price,
                  currency: definition.currency,
                  title: t('buyAnimal', { name: t(`species.${species}`) }),
                },
              )
            }
          >
            {t('buyYoung')}
          </Button>
          <Button onClick={onClose}>{common('close')}</Button>
        </>
      }
    >
      <div className="ui-stack">
        <Tabs
          value={unit}
          items={(['livestock', 'poultry', 'pond'] as const).map((id) => ({ id, label: t(id) }))}
          onChange={(id) => {
            const next = id as FarmUnit;
            setUnit(next);
            setSpecies(SPECIES[next][0]);
          }}
        />
        <section className="ui-section">
          <p>{t('shopCapacity', { count: animals.length, capacity: state.capacity[unit] })}</p>
          {state.capacity[unit] < FARM_UNIT_LIMITS[unit] && (
            <Button
              disabled={pending || state.coins < farmUnitPrice(unit, state.capacity[unit])}
              onClick={() =>
                void execute(
                  { type: 'expand', unit },
                  { price: farmUnitPrice(unit, state.capacity[unit]), title: t('upgradeCapacity') },
                )
              }
            >
              {t('expandCapacity', { coins: farmUnitPrice(unit, state.capacity[unit]).toLocaleString(i18n.language) })}
            </Button>
          )}
          <p>
            {state.capacity[unit] < FARM_UNIT_LIMITS[unit]
              ? t('nextCapacity', { next: state.capacity[unit] + 1, max: FARM_UNIT_LIMITS[unit] })
              : t('capacityMax', { count: state.capacity[unit] })}
          </p>
        </section>
        <section className="ui-section ui-purchase-section">
          <FarmPictureSelect
            label={t('animals')}
            value={species}
            onChange={setSpecies}
            items={SPECIES[unit].map((id) => ({
              value: id,
              image: farmAssetUrl(`${id}-growth-3`),
              label: t('animalBuyPrice', {
                name: t(`species.${id}`),
                price: FARM_ANIMAL_CATALOG[id].price.toLocaleString(i18n.language),
                currency: t(FARM_ANIMAL_CATALOG[id].currency),
              }),
            }))}
          />
          <p>
            {t('animalMaturity', {
              hours: definition.maturityMs / 3600000,
            })}
          </p>
          {definition.product && (
            <p>
              {t('productInfo', {
                yield: definition.yield,
                name: inventory(`products.${definition.product}`),
                hours: definition.cycleMs / 3600000,
              })}
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
