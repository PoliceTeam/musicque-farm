import type { Outfit } from '@chibi-town/character-core/character-types';
import type { CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { colors } from '@chibi-town/character-core/item-catalog';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterInventoryPage, CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { shopCss } from '@/assets/generated-styles';
import { CharacterPreview } from '@/features/character/_components/character-preview';
import { CosmeticThumbnail } from '@/features/character/_components/cosmetic-thumbnail';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';
import { changeShopPage, FIRST_SHOP_PAGE, type ShopPage } from '@/features/shop/_utils/shop-browsing';
import { loadShopDetails } from '@/features/shop/_utils/shop-details';

type Tab =
  | 'hair'
  | 'head'
  | 'eyes'
  | 'mouth'
  | 'nose'
  | 'skin'
  | 'sticker'
  | 'pants'
  | 'shirt'
  | 'shoes'
  | 'wrist'
  | 'pets'
  | 'held';
type Shop = 'salon' | 'premium' | 'pets' | 'accessories' | 'fashion';

function paletteColor(entry: Readonly<CosmeticDefinition>) {
  return entry.kind === 'item-color' ? Object.values(colors[entry.colorGroup][entry.colorValue])[2] : undefined;
}

export function ShopDialog({
  shop,
  onClose,
  onChanged,
}: {
  shop: Shop;
  onClose(): void;
  onChanged(page: CharacterInventoryPage): void;
}) {
  const { t } = useTranslation('shop');
  const [tab, setTab] = useState<Tab>(
    shop === 'pets' ? 'pets' : shop === 'accessories' ? 'held' : shop === 'fashion' ? 'shirt' : 'hair',
  );
  const [data, setData] = useState<CharacterInventoryPage>();
  const [details, setDetails] = useState<CharacterInventoryPage>();
  const [selections, setSelections] = useState<Partial<Record<Tab, { id: string; color?: string }>>>({});
  const [draft, setDraft] = useState<Outfit>();
  const selected = selections[tab]?.id;
  const color = selections[tab]?.color;
  const [browsing, setBrowsing] = useState<Partial<Record<Tab, ShopPage>>>({});
  const page = browsing[tab] ?? FIRST_SHOP_PAGE;
  const { history, index } = page;
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const current = useRef(0);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const cursor = history[index];
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads after purchases and outfit changes.
  useEffect(() => {
    const generation = ++current.current;
    setLoading(true);
    const query: CharacterInventoryQuery = {
      view: 'shop',
      shop,
      limit: 9,
      cursor,
      ...(tab === 'pets'
        ? { category: 'pet' as const }
        : tab === 'skin'
          ? { groupId: 'appearance/skin' }
          : { slot: tab }),
    };
    void getApiSdk()
      .getCharacterInventory(query)
      .then((page) => {
        if (generation !== current.current) return;
        setData(page);
        setError('');
        setDraft((value) => value ?? page.outfit);
        changed.current(page);
      })
      .catch(() => {
        if (generation === current.current) {
          setError(t('failed'));
          setData(undefined);
          setDetails(undefined);
        }
      })
      .finally(() => {
        if (generation === current.current) setLoading(false);
      });
    return () => {
      current.current++;
    };
  }, [shop, tab, cursor, refresh, t]);
  const root = data?.rows.find((row) => row.definition.id === selected);
  const groupId = root?.definition.groupId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh updates ownership without changing the selected group.
  useEffect(() => {
    if (!groupId) {
      setDetails(undefined);
      return;
    }
    let active = true;
    setDetails(undefined);
    void loadShopDetails(
      (query) => getApiSdk().getCharacterInventory(query),
      { view: 'shop', shop, groupId },
      () => active,
    )
      .then((page) => {
        if (active) setDetails(page);
      })
      .catch(() => {
        if (active) setError(t('failed'));
      });
    return () => {
      active = false;
    };
  }, [shop, groupId, refresh, t]);
  const choice = color ? details?.rows.find((row) => row.definition.id === color) : root;
  const preview = draft ?? data?.outfit;
  const locked = loading || mutating;
  const price = choice?.offer?.price.amount ?? 0;

  function reset() {
    setLoading(true);
    setData(undefined);
    setDetails(undefined);
    setNotice('');
    setError('');
  }

  function turnPage(direction: 'previous' | 'next') {
    if (locked) return;
    const next = changeShopPage(page, direction, data?.nextCursor);
    if (next === page) return;
    setBrowsing((values) => ({ ...values, [tab]: next }));
    reset();
  }

  function tryOn(entry: Readonly<CosmeticDefinition>, palette = false) {
    if (!data || locked || (palette && entry.groupId !== groupId)) return;
    if (entry.groupId !== groupId) setDetails(undefined);
    setSelections((values) => ({
      ...values,
      [tab]: { id: palette ? selected! : entry.id, color: palette ? entry.id : undefined },
    }));
    setDraft((value) => previewCosmetic(value ?? data.outfit, entry));
    setNotice('');
  }

  async function execute(use: boolean) {
    if (!choice || !data || busy.current || locked) return;
    const row = choice;
    const generation = current.current;
    busy.current = true;
    setMutating(true);
    setError('');
    setNotice('');
    try {
      await getApiSdk().execute({
        ...(use
          ? { type: 'equip-outfit' as const, outfit: previewCosmetic(data.outfit, row.definition) }
          : { type: 'buy-cosmetic' as const, offerId: row.definition.id }),
        requestId: crypto.randomUUID(),
        mapInstanceId: 'home',
      });
      if (generation !== current.current) return;
      setNotice(t(use ? 'applied' : 'bought', { name: row.definition.label }));
      setRefresh((value) => value + 1);
    } catch (reason) {
      if (generation !== current.current) return;
      const key =
        reason instanceof ApiSdkError && reason.code === 'INSUFFICIENT_COINS'
          ? 'insufficient'
          : reason instanceof ApiSdkError && reason.code === 'INVENTORY_FULL'
            ? 'full'
            : 'actionFailed';
      setError(t(key));
      // A lost response may follow a committed purchase; refresh authoritative ownership before retrying.
      setRefresh((value) => value + 1);
    } finally {
      busy.current = false;
      setMutating(false);
    }
  }

  const tabs: Tab[] =
    shop === 'salon'
      ? ['hair', 'head', 'eyes', 'mouth', 'nose', 'skin', 'sticker']
      : shop === 'fashion'
        ? ['shirt', 'pants', 'shoes']
        : shop === 'accessories'
          ? ['held']
          : shop === 'pets'
            ? ['pets']
            : ['hair', 'pants', 'shirt', 'shoes', 'wrist'];
  return (
    <Dialog
      title={t(shop)}
      className="shop-dialog"
      hideTitle
      showCloseFooter={false}
      closeLabel={t('close', { ns: 'common' })}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      tabs={
        <Tabs
          appearance="folder"
          label={t(shop)}
          value={tab}
          items={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))}
          onChange={(id) => {
            if (!busy.current && id !== tab) {
              setTab(id as Tab);
              reset();
            }
          }}
        />
      }
    >
      <style>{shopCss}</style>
      <div className="shop-content" aria-busy={locked}>
        <section className="shop-catalog" aria-label={t(`tabs.${tab}`)}>
          <section className="shop-list" aria-label={t(`tabs.${tab}`)}>
            <div className="shop-grid">
              {data?.rows.map((row) => (
                <button
                  type="button"
                  key={row.definition.id}
                  className={`shop-card${row.definition.id === selected ? ' is-selected' : ''}`}
                  aria-pressed={row.definition.id === selected}
                  disabled={locked}
                  onClick={() => {
                    tryOn(row.definition);
                  }}
                >
                  <CosmeticThumbnail definition={row.definition} />
                  <strong>{row.definition.label}</strong>
                  <span>
                    {row.owned
                      ? t('owned')
                      : t('balance', { amount: (row.offer?.price.amount ?? 0).toLocaleString('vi-VN') })}
                  </span>
                </button>
              ))}
            </div>
            {!data?.rows.length && !error && (
              <div className="shop-empty" role="status">
                <span className="shop-empty-symbol" aria-hidden="true">
                  ◇
                </span>
                <strong>{t(loading ? 'loading' : 'empty')}</strong>
                {!loading && <span>{t('emptyHint')}</span>}
              </div>
            )}
          </section>
          {(data?.total ?? 0) > 9 && (
            <nav
              className="shop-pages"
              aria-label={t('page', { page: index + 1, total: Math.max(1, Math.ceil((data?.total ?? 0) / 9)) })}
            >
              <Button
                disabled={locked || index === 0}
                onClick={() => {
                  turnPage('previous');
                }}
              >
                {t('previous')}
              </Button>
              <span>{t('page', { page: index + 1, total: Math.max(1, Math.ceil((data?.total ?? 0) / 9)) })}</span>
              <Button
                disabled={locked || !data?.nextCursor}
                onClick={() => {
                  turnPage('next');
                }}
              >
                {t('next')}
              </Button>
            </nav>
          )}
        </section>
        <aside className="shop-preview">
          <div className="shop-preview-stage">
            {preview && <CharacterPreview outfit={preview} label={t('preview')} />}
          </div>
          <div className="shop-selection">
            {choice && <span>{t('selected')}</span>}
            <strong>{choice?.definition.label ?? t('preview')}</strong>
          </div>
          {details?.rows.some((row) => row.definition.kind === 'item-color') && (
            <fieldset className="shop-palettes">
              <legend>{t('colors')}</legend>
              <button
                type="button"
                className="shop-base-palette"
                disabled={locked}
                aria-pressed={!color}
                title={t('base')}
                onClick={() => {
                  if (root) tryOn(root.definition);
                }}
              >
                {t('base')}
              </button>
              {details.rows
                .filter((row) => row.definition.kind === 'item-color')
                .map((row) => (
                  <button
                    type="button"
                    key={row.definition.id}
                    disabled={locked}
                    aria-label={row.definition.label}
                    title={`${row.definition.label}${row.owned ? ` · ${t('owned')}` : ''}`}
                    aria-pressed={color === row.definition.id}
                    onClick={() => tryOn(row.definition, true)}
                    style={{ background: paletteColor(row.definition) }}
                  >
                    <span>{row.owned ? '✓' : ''}</span>
                  </button>
                ))}
            </fieldset>
          )}
          {choice && (
            <Button
              className="shop-purchase"
              disabled={
                locked ||
                (!choice.owned && (!choice.canBuy || price > (data?.coins ?? 0))) ||
                choice.instance?.location.container === 'warehouse'
              }
              onClick={() => void execute(choice.owned)}
            >
              {choice.owned ? t('use') : t('buy', { price: price.toLocaleString('vi-VN') })}
            </Button>
          )}
          {choice && !choice.owned && !choice.canBuy && <p className="shop-help">{t('rootRequired')}</p>}
          {choice && !choice.owned && price > (data?.coins ?? 0) && <p className="shop-help">{t('insufficient')}</p>}
          {choice?.instance?.location.container === 'warehouse' && <p className="shop-help">{t('inWarehouse')}</p>}
        </aside>
      </div>
      {notice && (
        <p className="shop-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="shop-error" role="alert">
          {error}{' '}
          <Button
            disabled={locked}
            onClick={() => {
              setError('');
              setRefresh((value) => value + 1);
            }}
          >
            {t('retry')}
          </Button>
        </p>
      )}
    </Dialog>
  );
}
