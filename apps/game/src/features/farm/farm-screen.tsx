import type { GameSdk } from '@chibi-town/api-sdk';
import type { FarmVisit } from '@chibi-town/contracts/farm-social';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import {
  createFarmProgress,
  cropStage,
  type FarmAction,
  type FarmProgress,
  type FarmUnit,
  farmLandPrice,
} from '@chibi-town/gameplay';
import { Button } from '@chibi-town/ui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { LocationLayout } from '@/application/_components/location-layout';
import { getApiSdk, getDevelopmentTimeScale } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
import { FarmBatchDialog } from '@/features/farm/_components/farm-batch-dialog';
import { FarmCropSelector } from '@/features/farm/_components/farm-crop-selector';
import { FarmUnitPanel } from '@/features/farm/_components/farm-unit-panel';
import { FarmUnitShopDialog } from '@/features/farm/_components/farm-unit-shop-dialog';
import { KitchenDialog } from '@/features/farm/_components/kitchen-dialog';
import { farmInputAt } from '@/features/farm/_utils/farm-input-logic';
import { FARM_PLOTS } from '@/features/farm/_utils/farm-layout';
import { useFarmTime } from '@/features/farm/_utils/use-farm-time';
import { createFarmStore, type FarmCommand } from '@/features/farm/farm-store';
import { createFarmGame } from '@/features/farm/runtime/farm-game';
import { InventoryDialog } from '@/features/inventory/_components/inventory-dialog';

type Audio = ReturnType<typeof createGameAudio>;
type Selection = { plot: number } | { unit: FarmUnit };

export function FarmScreen({
  audio,
  definition,
  sdk,
  review = false,
}: {
  audio: Audio;
  definition?: MapDefinition;
  sdk?: GameSdk;
  review?: boolean;
}) {
  const { t, i18n } = useTranslation('farm');
  const { t: common } = useTranslation('common');
  const { t: inventory } = useTranslation('inventory');
  const LABELS = { livestock: t('livestock'), poultry: t('poultry'), pond: t('pond') };
  const navigation = useRouter();
  const ownerId = useSearchParams().get('owner');
  const [visit, setVisit] = useState<FarmVisit>();
  const [visitorWallet, setVisitorWallet] = useState<{ coins: number; gems: number }>();
  const [stealing, setStealing] = useState(false);
  const stealRequest = useRef<{ index: number; wateredAt: number; requestId: string }>(undefined);
  const model = useMemo(
    () =>
      createFarmStore(
        ownerId
          ? {
              ...(sdk ?? getApiSdk()),

              async getMap() {
                const api = sdk ?? getApiSdk();
                const [nextVisit, currentPlayer, wallet] = await Promise.all([
                  api.getFarmVisit(ownerId),
                  api.getPlayer(),
                  api.getInventory(),
                ]);
                setVisit(nextVisit);
                setVisitorWallet({ coins: wallet.farm.coins, gems: wallet.farm.gems });
                return { ...nextVisit.snapshot, outfit: currentPlayer.outfit };
              },
            }
          : (sdk ?? getApiSdk()),
        definition ? { regionId: definition.regionId, mapId: definition.id, instanceId: 'home' } : undefined,
      ),
    [sdk, definition, ownerId],
  );
  const snapshot = useStore(model.store, (state) => state.snapshot);
  const player = useStore(model.store, (state) => state.player);
  const pending = useStore(model.store, (state) => state.pending);
  const [cropId, setCropId] = useState<CropId>('tomato');
  const [failure, setFailure] = useState('');
  const [selection, setSelection] = useState<Selection>();
  const [shopUnit, setShopUnit] = useState<FarmUnit>('livestock');
  const [dialog, setDialog] = useState<'warehouse' | 'batch' | 'kitchen' | 'animals'>();
  const now = useFarmTime(snapshot?.serverTime, !!selection || !!dialog, review ? 1 : getDevelopmentTimeScale());
  const menu = useRef<HTMLDetailsElement>(null);
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
        menu.current?.removeAttribute('open');
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
    if (dialog) menu.current?.removeAttribute('open');
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
          const hit = farmInputAt(progress.current, x, y);
          if (hit.kind === 'exit') navigation.push('/farm');
          else if (ownerId) {
            if (hit.kind === 'plot' && hit.index < progress.current.owned) setSelection({ plot: hit.index });
            else setSelection(undefined);
          } else if (hit.kind === 'plot') setSelection({ plot: hit.index });
          else if (hit.kind === 'unit') setSelection({ unit: hit.unit });
          else if (hit.kind === 'shop') {
            setSelection(undefined);
            setShopUnit(hit.unit);
            setDialog('animals');
          } else if (hit.kind === 'warehouse' || hit.kind === 'kitchen') setDialog(hit.kind);
          else setSelection(undefined);
          return hit.selection;
        },
        units,
        target,
        () =>
          serverClock.current.server +
          (Date.now() - serverClock.current.real) * (review ? 1 : getDevelopmentTimeScale()),
        {
          enter: common('enterLocation'),
          exit: common('exitLocation'),

          avatarLabel: (level, name) => common('avatarName', { level, name }),

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
  }, [snapshot, navigation, t, review, model.store, common, ownerId]);

  const execute = useCallback(
    async (command: FarmCommand, confirm?: { price: number; title: string; currency?: 'coins' | 'gems' }) => {
      if (pending || ownerId) return;
      if (
        confirm &&
        !(await ui.current?.confirm({
          title: confirm.title,
          description: confirm.price
            ? t('price', {
                amount: confirm.price.toLocaleString(i18n.language),
                currency: t(confirm.currency ?? 'coins'),
              })
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
    },
    [pending, t, common, inventory, model, audio, i18n.language, ownerId],
  );

  const steal = async (index: number) => {
    const crop = snapshot?.farm.plots[index];
    if (!ownerId || stealing || failure || crop?.wateredAt == null) return;
    if (
      !stealRequest.current ||
      stealRequest.current.index !== index ||
      stealRequest.current.wateredAt !== crop.wateredAt
    )
      stealRequest.current = { index, wateredAt: crop.wateredAt, requestId: crypto.randomUUID() };
    setStealing(true);
    try {
      await (sdk ?? getApiSdk()).stealFarmCrop({ ...stealRequest.current, ownerId });
      stealRequest.current = undefined;
      await model.refresh();
      if (alive.current) ui.current?.notify(t('stolenSuccess'), 'success');
    } catch (error) {
      if (alive.current)
        ui.current?.notify(
          error instanceof Error && error.message === 'INVENTORY_FULL' ? inventory('chestFull') : t('stealFailed'),
          'error',
        );
      await model.refresh().catch(() => {});
    } finally {
      if (alive.current) setStealing(false);
    }
  };

  const state = snapshot?.farm;
  const unit = selection && 'unit' in selection ? selection.unit : undefined;
  return (
    <LocationLayout
      menuRef={menu}
      title={ownerId ? t('visitingTitle', { name: visit?.owner.name ?? '…' }) : review ? t('reviewTitle') : t('title')}
      accessibleTitle={t('accessibleTitle')}
      player={player}
      outfit={snapshot?.outfit}
      subtitle={t('profileLevel', {
        level: player?.level ?? '…',
        farmLevel: state ? 1 + Math.floor((state.owned - 6) / 6) : 1,
      })}
      audio={audio}
      coins={ownerId ? visitorWallet?.coins : state?.coins}
      gems={ownerId ? visitorWallet?.gems : state?.gems}
      menuActions={
        ownerId ? (
          <Button onClick={() => navigation.push('/farm')}>{t('returnEntrance')}</Button>
        ) : (
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
        )
      }
      counters={
        <strong className="ui-land-count">
          {t('landCount', { owned: state?.owned ?? '…', max: FARM_PLOTS.length })}
        </strong>
      }
    >
      <div id="farm-canvas" ref={host} />
      {ownerId && (
        <div className="farm-visit-banner">
          <span>{t('visitingHint')}</span>
          <Button onClick={() => navigation.push('/farm')}>{t('returnEntrance')}</Button>
        </div>
      )}
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
                      }[cropStage(state.plots[selection.plot], now)]}
                </p>
                {!ownerId && cropStage(state.plots[selection.plot], now) === 'tilled' && (
                  <FarmCropSelector value={cropId} onChange={setCropId} />
                )}
                {state.plots[selection.plot].cropId && (
                  <p>{inventory(`products.${state.plots[selection.plot].cropId ?? 'strawberry'}`)}</p>
                )}
                {cropStage(state.plots[selection.plot], now) === 'growing' && (
                  <p>
                    {t('growingTime', {
                      minutes: Math.ceil(
                        Math.max(
                          0,
                          FARM_CROPS[state.plots[selection.plot].cropId ?? 'strawberry'].growMs -
                            (now - state.plots[selection.plot].wateredAt!),
                        ) / 60000,
                      ),
                    })}
                  </p>
                )}
                {ownerId ? (
                  <div className="farm-tools">
                    {(state.plots[selection.plot].stolen || cropStage(state.plots[selection.plot], now) !== 'ripe') && (
                      <p>{t(state.plots[selection.plot].stolen ? 'cropAlreadyStolen' : 'cropNotReadyToSteal')}</p>
                    )}
                    <Button
                      variant="primary"
                      disabled={
                        stealing ||
                        !!failure ||
                        !!state.plots[selection.plot].stolen ||
                        cropStage(state.plots[selection.plot], now) !== 'ripe'
                      }
                      onClick={() => void steal(selection.plot)}
                    >
                      {t('stealCrop')}
                    </Button>
                  </div>
                ) : (
                  <div className="farm-tools">
                    {(() => {
                      const action: FarmAction =
                        selection.plot >= state.owned
                          ? 'buy'
                          : (
                              {
                                dry: 'till',
                                tilled: 'sow',
                                seeded: 'water',
                                growing: 'water',
                                ripe: 'harvest',
                              } as const
                            )[cropStage(state.plots[selection.plot], now)];
                      return (
                        <Button
                          variant="primary"
                          disabled={pending || cropStage(state.plots[selection.plot], now) === 'growing'}
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
                )}
              </>
            )}
            {unit && (
              <FarmUnitPanel
                key={unit}
                unit={unit}
                snapshot={snapshot!}
                now={now}
                pending={pending}
                execute={execute}
              />
            )}
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
        <FarmBatchDialog
          snapshot={snapshot}
          now={now}
          pending={pending}
          execute={execute}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog === 'kitchen' && state && (
        <KitchenDialog
          state={state}
          now={now}
          pending={pending}
          execute={execute}
          onClose={() => setDialog(undefined)}
        />
      )}
    </LocationLayout>
  );
}
