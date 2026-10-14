import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { CROP_IDS, type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import {
  createFarmProgress,
  cropStage,
  type FarmAction,
  type FarmProgress,
  type FarmUnit,
  farmLandPrice,
} from '@chibi-town/gameplay';
import { Button } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { LocationLayout } from '@/application/_components/location-layout';
import { createReviewSdk, getApiSdk, getDevelopmentTimeScale } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
import { FarmBatchDialog } from '@/features/farm/_components/farm-batch-dialog';
import { FarmCropSelector } from '@/features/farm/_components/farm-crop-selector';
import { FarmUnitPanel } from '@/features/farm/_components/farm-unit-panel';
import { FarmUnitShopDialog } from '@/features/farm/_components/farm-unit-shop-dialog';
import { KitchenDialog } from '@/features/farm/_components/kitchen-dialog';
import {
  FARM_EGG_BASKET_SPOTS,
  FARM_PLOTS,
  farmExpansionAt,
  farmFeatureAt,
  farmFeaturesFor,
  farmPlotAt,
  farmUnitPurchaseAt,
} from '@/features/farm/_utils/farm-map-data';
import { createFarmStore, type FarmCommand } from '@/features/farm/farm-store';
import { createFarmGame } from '@/features/farm/runtime/farm-game';
import { InventoryDialog } from '@/features/inventory/_components/inventory-dialog';

type Audio = ReturnType<typeof createGameAudio>;
type Selection = { plot: number } | { unit: FarmUnit };
const SPECIES: Record<FarmUnit, FarmSpecies[]> = {
  livestock: ['cow', 'pig', 'sheep'],
  poultry: ['hen', 'duck'],
  pond: ['fish'],
};

function reviewProgress(mode: string | null) {
  const state = createFarmProgress();
  if (mode === 'max' || mode === 'storage') {
    state.owned = FARM_PLOTS.length;
    state.capacity = { livestock: 20, poultry: 24, pond: 10 };
    state.units = { livestock: 2, pond: 2 };
    for (const unit of ['livestock', 'poultry', 'pond'] as const) {
      const animals = Array.from({ length: state.capacity[unit] }, (_, index) => ({
        species: SPECIES[unit][index % SPECIES[unit].length],
        boughtAt: Date.now() - 259200000,
        ageMs: 259200000,
        productionMs: 43200000,
      }));
      if (unit === 'livestock') state.animals = animals;
      else if (unit === 'poultry') state.poultry = animals;
      else state.fish = animals;
    }
    state.inventory = { strawberry: 12, seed: 8, rice: 1440, egg: 20, tomato: 1000 };
    state.gems = mode === 'storage' ? 1000 : 20;
    if (mode === 'storage') state.coins = 1_000_000;
    state.seeds = { tomato: 8, chili: 4 };
    state.animalStartedAt = Date.now();
    state.plots.forEach((plot) => {
      plot.stage = 'ripe';
    });
  }
  if (mode === 'crops') {
    state.owned = 24;
    state.chests.main = 3;
    state.plots.slice(0, 24).forEach((plot, i) => {
      plot.stage = 'ripe';
      plot.cropId = CROP_IDS[i % CROP_IDS.length];
    });
    for (const id of CROP_IDS) state.inventory[id] = 10;
  }
  if (mode === 'timers') {
    const now = Date.now();
    state.coins = 200000;
    state.animalStartedAt = now;
    state.fedAt = { livestock: now, poultry: now, pond: now };
    state.plots.slice(0, 6).forEach((plot, i) => {
      plot.cropId = 'tomato';
      plot.stage = 'growing';
      plot.wateredAt = now - (i === 0 ? 14400000 - 5000 : i === 1 ? 14400000 : 7200000);
    });
    state.poultry = [
      { species: 'hen', boughtAt: now - 86400000, careAt: now, ageMs: 86400000, productionMs: 21600000 - 5000 },
      { species: 'hen', boughtAt: now, careAt: now, ageMs: 43200000, productionMs: 0 },
      { species: 'duck', boughtAt: now, careAt: now, ageMs: 0, productionMs: 0 },
    ];
    state.animals = [{ species: 'cow', boughtAt: now, careAt: now, ageMs: 129600000, productionMs: 0 }];
    state.fish = [{ species: 'fish', boughtAt: now, careAt: now, ageMs: 129600000, productionMs: 0 }];
  }
  return state;
}

export function FarmScreen({ audio, definition }: { audio: Audio; definition?: MapDefinition }) {
  const { t } = useTranslation('farm');
  const { t: common } = useTranslation('common');
  const { t: inventory } = useTranslation('inventory');
  const LABELS = { livestock: t('livestock'), poultry: t('poultry'), pond: t('pond') };
  const navigation = useRouter();
  const review = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search).get('review') : null;
  const model = useMemo(
    () =>
      createFarmStore(
        review ? createReviewSdk(reviewProgress(review)) : getApiSdk(),
        definition ? { regionId: definition.regionId, mapId: definition.id, instanceId: 'home' } : undefined,
      ),
    [review, definition],
  );
  const snapshot = useStore(model.store, (state) => state.snapshot);
  const player = useStore(model.store, (state) => state.player);
  const pending = useStore(model.store, (state) => state.pending);
  const [cropId, setCropId] = useState<CropId>('tomato');
  const [failure, setFailure] = useState('');
  const [selection, setSelection] = useState<Selection>();
  const [shopUnit, setShopUnit] = useState<FarmUnit>('livestock');
  const [dialog, setDialog] = useState<'warehouse' | 'batch' | 'kitchen' | 'animals'>();
  const host = useRef<HTMLDivElement>(null);
  const obstacleLevels = useRef('');
  const game = useRef<Awaited<ReturnType<typeof createFarmGame>>>(undefined);
  const serverClock = useRef({ server: Date.now(), real: Date.now() });
  const progress = useRef<FarmProgress>(createFarmProgress());
  const ui = useRef<ReturnType<typeof createGameUi>>(undefined);
  const alive = useRef(true);
  const generation = useRef(0);
  const initialized = useRef(false);
  useEffect(() => {
    alive.current = true;
    document.body.classList.add('farm-style-sample');
    ui.current = createGameUi(document.body, audio);

    let polling = false;

    const read = async () => {
      if (polling) return;
      polling = true;
      try {
        await model.refresh();
        if (alive.current) setFailure('');
      } catch {
        if (alive.current) setFailure(t('progressLoadFailed'));
      } finally {
        polling = false;
      }
    };

    void read();
    const timer = setInterval(() => void read(), 1000);

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelection(undefined);
        document.querySelector('.farm-menu')?.removeAttribute('open');
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      alive.current = false;
      generation.current++;
      initialized.current = false;
      obstacleLevels.current = '';
      clearInterval(timer);
      window.removeEventListener('keydown', closeOnEscape);
      game.current?.destroy();
      game.current = undefined;
      ui.current?.destroy();
      document.body.classList.remove('farm-style-sample');
    };
  }, [audio, model, t]);
  useEffect(() => {
    if (dialog) document.querySelector<HTMLDetailsElement>('.farm-menu')?.removeAttribute('open');
  }, [dialog]);
  useEffect(() => {
    if (!snapshot) return;
    serverClock.current = { server: snapshot.serverTime, real: Date.now() };
    const target = progress.current;
    // Renderer retains these references; snapshots are copied into the presentation model only.
    const units = target.units;
    Object.assign(target, structuredClone(snapshot.farm));
    Object.assign(units, snapshot.farm.units);
    target.units = units;
    const levelsKey = JSON.stringify(units);
    if (!initialized.current) {
      initialized.current = true;
      obstacleLevels.current = levelsKey;
      const current = generation.current;
      void createFarmGame(
        host.current!,
        snapshot.outfit,
        (x, y) => {
          const state = progress.current;
          if (x >= 590 && x <= 690 && y >= 658) {
            navigation.push('/');
            return undefined;
          }
          const basket = FARM_EGG_BASKET_SPOTS.find(
            (spot) =>
              state.poultry.some((animal) => animal.species === spot.species) &&
              Math.abs(x - spot.x) < 24 &&
              y > spot.y - 40 &&
              y < spot.y + 18,
          );
          if (basket) {
            setSelection({ unit: 'poultry' });
            return { stand: [basket.x, basket.y + 24] };
          }
          const plot =
            farmPlotAt(x, y, state.owned) ?? (farmExpansionAt(x, y, state.owned) ? FARM_PLOTS[state.owned] : undefined);
          if (plot) {
            const index = FARM_PLOTS.indexOf(plot);
            setSelection({ plot: index });
            return plot;
          }
          const purchase = farmUnitPurchaseAt(x, y, farmFeaturesFor(state.units), state.capacity);
          if (purchase?.id === 'livestock' || purchase?.id === 'pond') {
            setSelection(undefined);
            setShopUnit(purchase.id);
            setDialog('animals');
            return { stand: purchase.stand };
          }
          const feature = farmFeatureAt(x, y, farmFeaturesFor(state.units), state.capacity);
          if (feature?.id === 'store') {
            setDialog('warehouse');
            return { stand: feature.stand };
          }
          if (feature?.id === 'kitchen') {
            setDialog('kitchen');
            return { stand: feature.stand };
          }
          if (feature?.id === 'exit') {
            navigation.push('/');
            return undefined;
          }
          if (feature?.id === 'livestock' || feature?.id === 'pond') {
            setSelection({ unit: feature.id });
            return { stand: feature.stand };
          }
          setSelection(undefined);
          return undefined;
        },
        units,
        target,
        () =>
          serverClock.current.server +
          (Date.now() - serverClock.current.real) * (review ? 1 : getDevelopmentTimeScale()),
        {
          ready: t('timerReady'),
          paused: t('timerPaused'),

          eggLabel: (species, count) => t(species === 'hen' ? 'basketHen' : 'basketDuck', { count }),
        },
        model.store.getState().player,
      )
        .then((next) => {
          if (alive.current && current === generation.current) game.current = next;
          else next.destroy();
        })
        .catch(() => {
          if (alive.current) setFailure(t('artLoadFailed'));
        });
    } else if (levelsKey !== obstacleLevels.current) {
      obstacleLevels.current = levelsKey;
      game.current?.refresh();
    }
  }, [snapshot, navigation, t, review, model.store]);

  async function execute(
    command: FarmCommand,
    confirm?: { price: number; title: string; currency?: 'coins' | 'gems' },
  ) {
    if (pending) return;
    if (
      confirm &&
      !(await ui.current?.confirm({
        title: confirm.title,
        description: confirm.price
          ? `${confirm.price.toLocaleString('vi-VN')} ${t(confirm.currency ?? 'coins')}`
          : t('sellDescription'),
        confirmLabel: common('confirm'),
      }))
    )
      return;
    if (!alive.current) return;
    try {
      const result = await model.execute(command);
      if (result && alive.current) {
        audio.play('success');
        ui.current?.notify(
          command.type === 'sell'
            ? t('sold')
            : t(command.type === 'batch' ? 'batchProcessed' : 'processed', {
                count: result.completed,
                total: result.eligible,
              }),
          'success',
        );
      }
    } catch (error) {
      if (alive.current) {
        audio.play('error');
        ui.current?.notify(
          error instanceof Error && error.message === 'INVENTORY_FULL' ? inventory('chestFull') : t('actionFailed'),
          'error',
        );
      }
    }
  }

  const state = snapshot?.farm;
  const unit = selection && 'unit' in selection ? selection.unit : undefined;
  return (
    <LocationLayout
      title={review ? t('reviewTitle') : t('title')}
      accessibleTitle={t('accessibleTitle')}
      player={player}
      outfit={snapshot?.outfit}
      subtitle={t('profileLevel', {
        level: player?.level ?? '…',
        farmLevel: state ? 1 + Math.floor((state.owned - 6) / 6) : 1,
      })}
      audio={audio}
      coins={state?.coins}
      gems={state?.gems}
      menuActions={
        <>
          <Button
            onClick={() => {
              setSelection(undefined);
              setDialog('animals');
            }}
          >
            {t('animalShop')}
          </Button>
          <Button onClick={() => setDialog('batch')}>{t('batch')}</Button>
        </>
      }
      counters={
        <strong className="ui-land-count">
          {t('landCount', { owned: state?.owned ?? '…', max: FARM_PLOTS.length })}
        </strong>
      }
    >
      <div id="farm-canvas" ref={host} />
      {failure && (
        <div className="ui-runtime-error" role="alert">
          {failure}
          <Button onClick={() => void model.refresh().catch(() => {})}>{common('retry')}</Button>
        </div>
      )}
      {state && selection && (
        <section className="farm-selection" aria-label={t('selection')}>
          <header>
            <h2>{unit ? LABELS[unit] : t('plot', { index: 'plot' in selection ? selection.plot + 1 : '' })}</h2>
            <Button
              className="ui-icon-button"
              aria-label={common('close')}
              onClick={() => {
                setSelection(undefined);
                game.current?.clearSelection();
              }}
            >
              ×
            </Button>
          </header>
          <div className="ui-panel-body">
            {'plot' in selection && (
              <>
                <p>
                  {selection.plot >= state.owned
                    ? t('expandLand')
                    : {
                        dry: t('dry'),
                        tilled: t('tilled'),
                        seeded: t('seeded'),
                        growing: t('growing'),
                        ripe: t('ripe'),
                      }[cropStage(state.plots[selection.plot], snapshot!.serverTime)]}
                </p>
                {cropStage(state.plots[selection.plot], snapshot!.serverTime) === 'tilled' && (
                  <FarmCropSelector value={cropId} onChange={setCropId} />
                )}
                {state.plots[selection.plot].cropId && (
                  <p>{inventory(`products.${state.plots[selection.plot].cropId ?? 'strawberry'}`)}</p>
                )}
                {cropStage(state.plots[selection.plot], snapshot!.serverTime) === 'growing' && (
                  <p>
                    {t('growingTime', {
                      minutes: Math.ceil(
                        Math.max(
                          0,
                          FARM_CROPS[state.plots[selection.plot].cropId ?? 'strawberry'].growMs -
                            (snapshot!.serverTime - state.plots[selection.plot].wateredAt!),
                        ) / 60000,
                      ),
                    })}
                  </p>
                )}
                <div className="farm-tools">
                  {(() => {
                    const action: FarmAction =
                      selection.plot >= state.owned
                        ? 'buy'
                        : ({ dry: 'till', tilled: 'sow', seeded: 'water', growing: 'water', ripe: 'harvest' } as const)[
                            cropStage(state.plots[selection.plot], snapshot!.serverTime)
                          ];
                    return (
                      <Button
                        variant="primary"
                        disabled={pending || cropStage(state.plots[selection.plot], snapshot!.serverTime) === 'growing'}
                        onClick={() =>
                          void execute(
                            { type: 'plot', index: selection.plot, action, cropId },
                            action === 'buy' ? { price: farmLandPrice(state.owned), title: t('buy') } : undefined,
                          )
                        }
                      >
                        {
                          {
                            buy: t('buy'),
                            till: t('till'),
                            sow: t('sowSelected', { name: inventory(`products.${cropId}`) }),
                            water: t('water'),
                            harvest: t('harvest'),
                          }[action]
                        }
                      </Button>
                    );
                  })()}
                </div>
              </>
            )}
            {unit && <FarmUnitPanel key={unit} unit={unit} snapshot={snapshot!} pending={pending} execute={execute} />}
          </div>
        </section>
      )}
      {dialog === 'animals' && snapshot && (
        <FarmUnitShopDialog
          snapshot={snapshot}
          initialUnit={shopUnit}
          pending={pending}
          execute={execute}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog === 'warehouse' && (
        <InventoryDialog state={state} pending={pending} execute={execute} onClose={() => setDialog(undefined)} />
      )}
      {dialog === 'batch' && (
        <FarmBatchDialog snapshot={snapshot} pending={pending} execute={execute} onClose={() => setDialog(undefined)} />
      )}
      {dialog === 'kitchen' && state && (
        <KitchenDialog
          state={state}
          now={snapshot!.serverTime}
          pending={pending}
          execute={execute}
          onClose={() => setDialog(undefined)}
        />
      )}
    </LocationLayout>
  );
}
