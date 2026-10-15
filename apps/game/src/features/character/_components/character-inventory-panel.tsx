import type { Outfit } from '@chibi-town/character-core/character-types';
import type { CosmeticCategory } from '@chibi-town/character-core/cosmetic-catalog';
import { cosmeticCategoryForSlot } from '@chibi-town/character-core/cosmetic-catalog';
import { outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type {
  CharacterInventoryCommand,
  CharacterInventoryPage,
  CharacterInventoryQuery,
} from '@chibi-town/contracts/character-inventory';
import { Button, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { CosmeticThumbnail } from '@/features/character/_components/cosmetic-thumbnail';

type Props = { onOutfit: (outfit: Outfit) => void; disabled?: boolean };

export function CharacterInventoryPanel({ onOutfit, disabled }: Props) {
  const { t, i18n } = useTranslation('inventory');
  const [query, setQuery] = useState<CharacterInventoryQuery>({ view: 'equipped' });
  const [page, setPage] = useState<CharacterInventoryPage>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const busy = useRef(false);
  const generation = useRef(0);
  const outfitCallback = useRef(onOutfit);
  outfitCallback.current = onOutfit;
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh token deliberately reloads an unchanged query after a command or retry.
  useEffect(() => {
    const current = ++generation.current;
    setPending(true);
    setError('');
    void getApiSdk()
      .getCharacterInventory(query)
      .then((result) => {
        if (current !== generation.current) return;
        setPage(result);
        outfitCallback.current(result.outfit);
      })
      .catch(() => {
        if (current === generation.current) setError(t('character.failed'));
      })
      .finally(() => {
        if (current === generation.current) setPending(false);
      });
    return () => {
      generation.current++;
    };
  }, [query, refresh, t]);

  function navigate(next: CharacterInventoryQuery) {
    setHistory([]);
    setQuery(next);
  }

  async function execute(command: CharacterInventoryCommand) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    const current = generation.current;
    try {
      const result = await getApiSdk().execute({ ...command, requestId: crypto.randomUUID(), mapInstanceId: 'home' });
      if (current !== generation.current) return;
      outfitCallback.current(result.outfit);
      // Removing the final row of a page invalidates its cursor; return to the first page after mutations.
      setHistory([]);
      setQuery((previous) => ({ ...previous, cursor: undefined }));
      setRefresh((value) => value + 1);
    } catch (reason) {
      if (current === generation.current) {
        const key =
          reason instanceof ApiSdkError && reason.code === 'INSUFFICIENT_COINS'
            ? 'insufficient'
            : reason instanceof ApiSdkError && reason.code === 'INVENTORY_FULL'
              ? 'full'
              : reason instanceof ApiSdkError && reason.code === 'NOT_ALLOWED'
                ? 'notAllowed'
                : 'failed';
        setError(t(`character.${key}`));
      }
    } finally {
      busy.current = false;
      if (current === generation.current) setPending(false);
    }
  }

  const locked = pending || disabled;
  return (
    <section className="character-inventory-panel" aria-busy={pending}>
      <Tabs
        label={t('character.views')}
        items={(['equipped', 'bag', 'warehouse', 'shop'] as const).map((id) => ({ id, label: t(`character.${id}`) }))}
        value={query.view}
        onChange={(view) => {
          if (!busy.current)
            navigate({
              ...query,
              view: view as CharacterInventoryQuery['view'],
              groupId: undefined,
              cursor: undefined,
            });
        }}
      />
      <fieldset className="character-inventory-categories" disabled={locked}>
        <legend>{t('character.category')}</legend>
        <Tabs
          label={t('character.category')}
          value={query.category ?? 'all'}
          items={(['all', 'equipment', 'appearance', 'pet'] as const).map((id) => ({
            id,
            label: t(`character.${id}`),
          }))}
          onChange={(category) =>
            navigate({ view: query.view, category: category === 'all' ? undefined : (category as CosmeticCategory) })
          }
        />
      </fieldset>
      {query.category && query.category !== 'pet' && (
        <label className="character-inventory-filter">
          {t('character.slot')}
          <select
            value={query.slot ?? ''}
            disabled={locked}
            onChange={(event) =>
              navigate({ view: query.view, category: query.category, slot: event.target.value || undefined })
            }
          >
            <option value="">{t('character.all')}</option>
            {outfitFields
              .filter((field) => field.slot && cosmeticCategoryForSlot(field.slot) === query.category)
              .map((field) => (
                <option key={field.slot} value={field.slot}>
                  {field.label}
                </option>
              ))}
          </select>
        </label>
      )}
      {page && (
        <p>
          {t('character.capacity', { used: page.bagUsed, slots: page.bagSlots })} ·{' '}
          {t('character.wallet', {
            coins: page.coins.toLocaleString(i18n.language),
            gems: page.gems.toLocaleString(i18n.language),
          })}
        </p>
      )}
      {query.groupId && (
        <Button disabled={locked} onClick={() => navigate({ view: query.view, category: query.category })}>
          {t('character.allGroups')}
        </Button>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <Button disabled={locked} onClick={() => setRefresh((value) => value + 1)}>
            {t('character.retry')}
          </Button>
        </p>
      )}
      {pending && <p role="status">{t('character.loading')}</p>}
      {!pending && page?.rows.length === 0 && <p>{t('character.empty')}</p>}
      <div className="character-inventory-grid">
        {page?.rows.map((row) => (
          <article className="character-inventory-card" key={row.definition.id}>
            <CosmeticThumbnail definition={row.definition} colorUnlockId={row.instance?.colorUnlockId} />
            <h3>{row.definition.label}</h3>
            {row.owned && <span>{t('character.owned')}</span>}
            <div className="character-inventory-actions">
              {query.view === 'shop' && !row.owned && row.offer && (
                <Button
                  disabled={locked || !row.canBuy}
                  onClick={() => void execute({ type: 'buy-cosmetic', offerId: row.offer!.id })}
                >
                  {t('character.buy', { price: row.offer.price.amount.toLocaleString(i18n.language) })}
                </Button>
              )}
              {query.view === 'shop' && row.definition.kind === 'item-color' && !row.owned && !row.canBuy && (
                <small>{t('character.rootRequired')}</small>
              )}
              {row.owned && (row.definition.kind === 'item-color' || row.definition.kind === 'skin-color') && (
                <Button
                  disabled={locked || !row.canApply}
                  onClick={() => void execute({ type: 'apply-cosmetic-color', cosmeticId: row.definition.id })}
                >
                  {t('character.apply')}
                </Button>
              )}
              {row.instance?.location.container === 'bag' && (
                <>
                  <Button
                    disabled={locked}
                    onClick={() => void execute({ type: 'equip-character-item', instanceId: row.instance!.instanceId })}
                  >
                    {t('character.wear')}
                  </Button>
                  <Button
                    disabled={locked}
                    onClick={() =>
                      void execute({
                        type: 'move-character-item',
                        instanceId: row.instance!.instanceId,
                        to: 'warehouse',
                      })
                    }
                  >
                    {t('character.store')}
                  </Button>
                </>
              )}
              {row.instance?.location.container === 'equipped' && row.canUnequip && (
                <Button
                  disabled={locked}
                  onClick={() => void execute({ type: 'unequip-character-item', instanceId: row.instance!.instanceId })}
                >
                  {t('character.remove')}
                </Button>
              )}
              {row.instance?.location.container === 'warehouse' && (
                <Button
                  disabled={locked || Boolean(page && page.bagUsed >= page.bagSlots)}
                  onClick={() =>
                    void execute({ type: 'move-character-item', instanceId: row.instance!.instanceId, to: 'bag' })
                  }
                >
                  {t('character.take')}
                </Button>
              )}
              {!query.groupId && (
                <Button
                  disabled={locked}
                  onClick={() =>
                    navigate({ view: 'shop', groupId: row.definition.groupId, category: row.definition.category })
                  }
                >
                  {t('character.colors')}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="muted">{t('character.colorPermanent')}</p>
      <div className="character-inventory-pagination">
        <Button
          disabled={locked || !history.length}
          onClick={() => {
            const cursor = history.at(-1);
            setHistory((values) => values.slice(0, -1));
            setQuery((previous) => ({ ...previous, cursor }));
          }}
        >
          {t('character.previous')}
        </Button>
        {page && <span>{t('character.count', { count: page.total })}</span>}
        <Button
          disabled={locked || !page?.nextCursor}
          onClick={() => {
            setHistory((values) => [...values, query.cursor]);
            setQuery((previous) => ({ ...previous, cursor: page!.nextCursor! }));
          }}
        >
          {t('character.next')}
        </Button>
      </div>
    </section>
  );
}
