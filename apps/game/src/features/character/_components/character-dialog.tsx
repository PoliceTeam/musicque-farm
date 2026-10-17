import type { Outfit } from '@chibi-town/character-core/character-types';
import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import type { CharacterInventoryCommand, CharacterInventoryPage } from '@chibi-town/contracts/character-inventory';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { characterPanelCss } from '@/assets/generated-styles';
import { CharacterProfile } from '@/features/character/_components/character-profile';
import { CosmeticThumbnail } from '@/features/character/_components/cosmetic-thumbnail';

type Tab = 'information' | 'equipped' | 'basket';
const SLOT_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'];

export function CharacterDialog({ onClose, onOutfit }: { onClose(): void; onOutfit?(outfit: Outfit): void }) {
  const { t } = useTranslation('inventory');
  const [tab, setTab] = useState<Tab>('information');
  const [player, setPlayer] = useState<Awaited<ReturnType<GameSdk['getPlayer']>>>();
  const [page, setPage] = useState<CharacterInventoryPage>();
  const [selected, setSelected] = useState<string>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const generation = useRef(0);
  const view = tab === 'basket' ? 'unequipped' : 'equipped';
  const cursor = cursors[index];
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh reloads the same query after an inventory command or retry.
  useEffect(() => {
    const current = ++generation.current;
    setPending(true);
    setError('');
    void Promise.all([getApiSdk().getPlayer(), getApiSdk().getCharacterInventory({ view, cursor, limit: 12 })])
      .then(([account, inventory]) => {
        if (generation.current !== current) return;
        setPlayer(account);
        setPage(inventory);
        setSelected((id) =>
          inventory.rows.some((row) => row.definition.id === id) ? id : inventory.rows[0]?.definition.id,
        );
      })
      .catch(() => {
        if (generation.current === current) setError(t('character.loadFailed'));
      })
      .finally(() => {
        if (generation.current === current) setPending(false);
      });
    return () => {
      generation.current++;
    };
  }, [view, cursor, refresh, t]);

  async function execute(command: CharacterInventoryCommand) {
    if (busy.current || pending) return;
    busy.current = true;
    setPending(true);
    const current = generation.current;
    try {
      const result = await getApiSdk().execute({ ...command, requestId: crypto.randomUUID(), mapInstanceId: 'home' });
      if (current !== generation.current) return;
      onOutfit?.(result.outfit);
      setPlayer((value) => value && { ...value, outfit: result.outfit });
      setPage((value) => value && { ...value, outfit: result.outfit });
      setCursors([undefined]);
      setIndex(0);
      setRefresh((value) => value + 1);
    } catch (reason) {
      if (current === generation.current) {
        setError(
          t(reason instanceof ApiSdkError && reason.code === 'INVENTORY_FULL' ? 'character.full' : 'character.failed'),
        );
        setPending(false);
      }
    } finally {
      busy.current = false;
    }
  }

  function changeTab(value: string) {
    if (busy.current) return;
    setTab(value as Tab);
    setPage(undefined);
    setSelected(undefined);
    setCursors([undefined]);
    setIndex(0);
    setRefresh((count) => count + 1);
  }

  const item = page?.rows.find((row) => row.definition.id === selected);
  const rows = SLOT_IDS.map((id, position) => ({ id, row: page?.rows[position] }));
  return (
    <Dialog
      title={t('character.title')}
      className="character-dialog"
      hideTitle
      closeLabel={t('close', { ns: 'common' })}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      tabs={
        <Tabs
          appearance="folder"
          label={t('character.title')}
          value={tab}
          onChange={changeTab}
          items={(['information', 'equipped', 'basket'] as const).map((id) => ({ id, label: t(`character.${id}`) }))}
        />
      }
      footer={
        tab !== 'information' &&
        !!page &&
        page.total > 12 && (
          <div className="character-page-controls">
            <Button disabled={pending || index === 0} onClick={() => setIndex((value) => value - 1)}>
              {t('character.previous')}
            </Button>
            <span>{t('character.pageNumber', { page: index + 1, pages: Math.ceil(page.total / 12) })}</span>
            <Button
              disabled={pending || !page.nextCursor}
              onClick={() => {
                setCursors((list) => [...list.slice(0, index + 1), page.nextCursor!]);
                setIndex((value) => value + 1);
              }}
            >
              {t('character.next')}
            </Button>
          </div>
        )
      }
    >
      <style>{characterPanelCss}</style>
      {error && (
        <p role="alert">
          {error}{' '}
          <Button disabled={pending} onClick={() => setRefresh((value) => value + 1)}>
            {t('character.retry')}
          </Button>
        </p>
      )}
      {pending && (
        <p className="character-panel-loading" role="status">
          {t('character.loading')}
        </p>
      )}
      {tab === 'information' ? (
        <CharacterProfile player={player} outfit={page?.outfit} coins={page?.coins} gems={page?.gems} />
      ) : (
        <div className="character-items-panel" aria-busy={pending}>
          <div className="character-items-heading">
            {page && <span>{t('character.count', { count: page.total })}</span>}
          </div>
          <div className="character-slot-grid">
            {rows.map(({ id, row }) =>
              row ? (
                <button
                  key={row.definition.id}
                  type="button"
                  disabled={pending}
                  aria-pressed={row.definition.id === selected}
                  aria-label={t('character.chooseItem', { name: row.definition.label })}
                  onClick={() => setSelected(row.definition.id)}
                >
                  <CosmeticThumbnail definition={row.definition} colorUnlockId={row.instance?.colorUnlockId} />
                </button>
              ) : (
                <div className="character-empty-slot" key={id} aria-hidden="true" />
              ),
            )}
          </div>
          <div className={`character-selected-item${!item ? ' is-empty' : ''}`}>
            {item ? (
              <>
                <strong>{item.definition.label}</strong>
                {'level' in item.definition && item.definition.level !== undefined && (
                  <span>{t('character.selectedLevel', { level: item.definition.level })}</span>
                )}
                <span>{t(`character.itemLocation.${item.instance?.location.container ?? 'unlock'}`)}</span>
                <div className="character-item-actions">
                  {item.instance && item.instance.location.container === 'bag' && (
                    <Button
                      disabled={pending}
                      onClick={() =>
                        void execute({ type: 'equip-character-item', instanceId: item.instance!.instanceId })
                      }
                    >
                      {t('character.wear')}
                    </Button>
                  )}
                  {item.instance?.location.container === 'warehouse' && (
                    <Button
                      disabled={pending || (page && page.bagUsed >= page.bagSlots)}
                      onClick={() =>
                        void execute({ type: 'move-character-item', instanceId: item.instance!.instanceId, to: 'bag' })
                      }
                    >
                      {t('character.take')}
                    </Button>
                  )}
                  {item.canUnequip && item.instance && (
                    <Button
                      disabled={pending}
                      onClick={() =>
                        void execute({ type: 'unequip-character-item', instanceId: item.instance!.instanceId })
                      }
                    >
                      {t('character.remove')}
                    </Button>
                  )}
                  {item.canApply && (
                    <Button
                      disabled={pending}
                      onClick={() => void execute({ type: 'apply-cosmetic-color', cosmeticId: item.definition.id })}
                    >
                      {t('character.apply')}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              !pending && <p>{t('character.empty')}</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
