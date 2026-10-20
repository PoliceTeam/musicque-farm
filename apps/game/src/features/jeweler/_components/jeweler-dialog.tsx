import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterInventoryPage, CharacterInventoryRow } from '@chibi-town/contracts/character-inventory';
import type { JewelerCommand, JewelerSnapshot } from '@chibi-town/contracts/jeweler';
import { JEWELER_MATERIALS, type JewelerMaterialId } from '@chibi-town/game-content/jeweler';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppImage } from '@/application/_components/app-image';
import { getApiSdk } from '@/application/api-sdk';
import { publicAssetUrls } from '@/assets/generated-assets';
import { characterPanelCss, jewelerCss } from '@/assets/generated-styles';
import {
  CharacterUpgradeAction,
  CharacterUpgradePanel,
} from '@/features/character/_components/character-upgrade-panel';

type UpgradeCommand = {
  type: 'upgrade-character-item';
  instanceId: string;
  targetId: string;
  requestId: string;
  mapInstanceId: string;
  currency: 'coins' | 'gems';
  recipeVersion: number;
};
type Operation = { kind: 'market'; input: JewelerCommand } | { kind: 'upgrade'; input: UpgradeCommand };

export function JewelerDialog({ onClose, onChanged }: { onClose(): void; onChanged(): void }) {
  const { t, i18n } = useTranslation('jeweler');
  const { t: common } = useTranslation('common');
  const [mode, setMode] = useState<'menu' | 'market' | 'upgrades'>('menu');
  const [tab, setTab] = useState('buy');
  const [currency, setCurrency] = useState<'coins' | 'gems'>('coins');
  const [data, setData] = useState<JewelerSnapshot>();
  const [page, setPage] = useState<CharacterInventoryPage>();
  const [selected, setSelected] = useState<string>();
  const [materialId, setMaterial] = useState<JewelerMaterialId>('blue');
  const [count, setCount] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [cursor, setCursor] = useState<string>();
  const retry = useRef<Operation | undefined>(undefined);
  const busy = useRef(false);
  const alive = useRef(true);
  const disabled = pending || !!retry.current;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads after upgrades and failed reads.
  useEffect(() => {
    let cancelled = false;
    setPending(true);
    void Promise.all([
      getApiSdk().getJeweler(),
      getApiSdk().getCharacterInventory({ view: 'upgrades', limit: 50, cursor }),
    ])
      .then(([snapshot, inventory]) => {
        if (!cancelled) {
          setData(snapshot);
          setPage(inventory);
          setError('');
          setSelected((id) =>
            inventory.rows.some((row) => row.definition.id === id) ? id : inventory.rows[0]?.definition.id,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, cursor, t]);

  const format = (n: number) => n.toLocaleString(i18n.language);

  const material = JEWELER_MATERIALS.find((m) => m.id === materialId)!;
  const upgradePage = page && {
    ...page,
    rows: page.rows
      .filter((row) => currency === 'coins' || row.upgrade?.gemPrice != null)
      .sort((a, b) => Number(!a.upgrade?.target) - Number(!b.upgrade?.target)),
  };
  const recipe = 'recipe' in material ? material.recipe : undefined;
  const owned = data?.materials[materialId] ?? 0;
  const canTrade = data && (tab === 'buy' ? data.availableCoins >= material.buy * count : owned >= count);
  const canFuse = data && recipe && data.materials[recipe.material] >= recipe.count * count;

  async function execute(operation: Operation) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    try {
      if (operation.kind === 'market') {
        const snapshot = await getApiSdk().executeJeweler(operation.input);
        if (!alive.current) return;
        setData(snapshot);
        setPage(
          (value) =>
            value && {
              ...value,
              coins: snapshot.coins,
              availableCoins: snapshot.availableCoins,
              gems: snapshot.gems,
              rows: value.rows.map((row) => ({
                ...row,
                ...(row.upgrade
                  ? {
                      upgrade: {
                        ...row.upgrade,
                        materials: row.upgrade.materials.map((m) => ({
                          ...m,
                          owned: snapshot.materials[m.materialId],
                        })),
                      },
                    }
                  : {}),
              })),
            },
        );
        const key =
          operation.input.type === 'buy'
            ? 'successBuy'
            : operation.input.type === 'sell'
              ? 'successSell'
              : 'successFuse';
        setNotice(t(key, { count: operation.input.count, name: t(`materials.${operation.input.materialId}`) }));
      } else {
        const result = await getApiSdk().execute(operation.input);
        if (!result.upgrade) throw new ApiSdkError('NETWORK_ERROR');
        if (!alive.current) return;
        setNotice(t(result.upgrade.success ? 'successUpgrade' : 'failedUpgrade'));
        if (result.upgrade.success) setSelected(operation.input.targetId);
        setCursor(undefined);
        setRefresh((n) => n + 1);
      }
      retry.current = undefined;
      onChanged();
    } catch (reason) {
      if (!alive.current) return;
      if (!(reason instanceof ApiSdkError) || ['NETWORK_ERROR', 'STORAGE_UNAVAILABLE'].includes(reason.code)) {
        retry.current = operation;
        setError(t('retryHint'));
      } else {
        retry.current = undefined;
        setError(
          t(
            reason.code === 'NOT_NEAR_JEWELER'
              ? 'notNear'
              : reason.code === 'INSUFFICIENT_GEMS'
                ? 'insufficientGems'
                : reason.code === 'NOT_ENOUGH_MATERIALS'
                  ? 'missingMaterials'
                  : reason.code === 'INSUFFICIENT_COINS'
                    ? 'insufficient'
                    : 'failed',
          ),
        );
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  function trade(type: JewelerCommand['type']) {
    void execute({ kind: 'market', input: { type, materialId, count, requestId: crypto.randomUUID() } });
  }

  function upgrade(row: CharacterInventoryRow) {
    if (!row.instance || !row.upgrade?.target) return;
    void execute({
      kind: 'upgrade',
      input: {
        type: 'upgrade-character-item',
        instanceId: row.instance.instanceId,
        targetId: row.upgrade.target.id,
        requestId: crypto.randomUUID(),
        mapInstanceId: 'home',
        currency,
        recipeVersion: row.upgrade.recipeVersion,
      },
    });
  }

  return (
    <Dialog
      title={t(mode === 'menu' ? 'title' : mode)}
      className={`jeweler-dialog${mode === 'menu' ? '' : ' is-tabbed'}`}
      hideTitle={mode !== 'menu'}
      tabs={
        mode === 'menu' ? undefined : (
          <Tabs
            appearance="folder"
            label={t(mode)}
            items={
              mode === 'market'
                ? [
                    { id: 'buy', label: t('buy') },
                    { id: 'sell', label: t('sell') },
                  ]
                : [
                    { id: 'coins', label: t('coins') },
                    { id: 'gems', label: t('gems') },
                  ]
            }
            value={mode === 'market' ? tab : currency}
            onChange={(value) => {
              if (!disabled) {
                if (mode === 'market') setTab(value);
                else setCurrency(value as 'coins' | 'gems');
                setNotice('');
              }
            }}
          />
        )
      }
      onClose={() => {
        if (!busy.current && !retry.current) onClose();
      }}
      closeLabel={common('close')}
      showCloseFooter={false}
      footer={
        mode === 'market' && data ? (
          <div className="jeweler-actions">
            <Button
              variant="primary"
              disabled={disabled || !canTrade}
              onClick={() => trade(tab === 'buy' ? 'buy' : 'sell')}
            >
              {t(tab === 'buy' ? 'buyAction' : 'sellAction', {
                count,
                amount: format((tab === 'buy' ? material.buy : material.sell) * count),
              })}
            </Button>
            {tab === 'buy' && recipe && (
              <Button disabled={disabled || !canFuse} onClick={() => trade('fuse')}>
                {t('fuse', { count, name: t(`materials.${materialId}`) })}
              </Button>
            )}
          </div>
        ) : mode === 'upgrades' && upgradePage ? (
          <CharacterUpgradeAction
            key={`${currency}/${selected}/${page?.revision}`}
            currency={currency}
            page={upgradePage}
            selected={selected}
            pending={disabled}
            onUpgrade={upgrade}
          />
        ) : undefined
      }
    >
      <style>
        {jewelerCss}
        {characterPanelCss}
      </style>
      {error && (
        <p role="alert">
          {error}{' '}
          <Button
            disabled={pending}
            onClick={() => (retry.current ? void execute(retry.current) : setRefresh((n) => n + 1))}
          >
            {t('retry')}
          </Button>
        </p>
      )}
      {notice && (
        <p role="status" className="jeweler-notice">
          {notice}
        </p>
      )}
      {pending && <p role="status">{t('loading')}</p>}
      {mode === 'menu' ? (
        <div className="jeweler-menu">
          <p>{t('greeting')}</p>
          <Button disabled={disabled} onClick={() => setMode('market')}>
            {t('market')}
          </Button>
          <Button disabled={disabled} onClick={() => setMode('upgrades')}>
            {t('upgrades')}
          </Button>
        </div>
      ) : mode === 'market' ? (
        <>
          <p className="jeweler-intro">{t('marketHint')}</p>
          <div className="jeweler-grid">
            {JEWELER_MATERIALS.map((m) => (
              <button
                type="button"
                disabled={disabled}
                key={m.id}
                aria-pressed={materialId === m.id}
                onClick={() => {
                  setMaterial(m.id);
                  setCount(1);
                  setNotice('');
                }}
              >
                <AppImage
                  className="jeweler-stone"
                  src={publicAssetUrls[`jeweler/${m.id}.webp`]}
                  width={80}
                  height={80}
                  alt=""
                  aria-hidden="true"
                />
                <strong>{t(`materials.${m.id}`)}</strong>
                <span>{t('price', { amount: format(tab === 'buy' ? m.buy : m.sell) })}</span>
                <small>{t('owned', { count: data?.materials[m.id] ?? 0 })}</small>
              </button>
            ))}
          </div>
          <label className="jeweler-quantity">
            {t('quantity')}
            <input
              type="number"
              min={1}
              max={1000}
              step={1}
              value={count}
              disabled={disabled}
              onChange={(event) => setCount(Math.max(1, Math.min(1000, Math.trunc(Number(event.target.value)) || 1)))}
            />
          </label>
          {tab === 'buy' && recipe && (
            <div className="jeweler-recipe">
              <strong>
                {t('recipe', {
                  count: recipe.count,
                  source: t(`materials.${recipe.material}`),
                  target: t(`materials.${materialId}`),
                })}
              </strong>
              <small>{t('fuseHint')}</small>
            </div>
          )}
        </>
      ) : (
        <>
          {upgradePage && (
            <>
              <CharacterUpgradePanel
                layout="sidebar"
                page={upgradePage}
                currency={currency}
                selected={selected}
                pending={disabled}
                onSelect={setSelected}
              />
              {(cursor || page?.nextCursor) && (
                <div className="jeweler-pages">
                  <Button disabled={disabled || !cursor} onClick={() => setCursor(undefined)}>
                    {t('previous')}
                  </Button>
                  <Button
                    disabled={disabled || !page?.nextCursor}
                    onClick={() => setCursor(page?.nextCursor ?? undefined)}
                  >
                    {t('next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
