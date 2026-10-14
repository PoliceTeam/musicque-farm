import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { chestUpgradePrice } from '@chibi-town/game-content/farm-upgrade-catalog';
import { FARM_PRODUCTS, type FarmProduct, type FarmProgress } from '@chibi-town/gameplay';
import {
  chestInventory,
  chestSlots,
  FARM_CHEST_SLOTS,
  occupiedChestSlots,
} from '@chibi-town/gameplay/farm-storage-logic';
import { Button, Dialog, EmptyState, InventoryGrid, type InventoryItem, Tabs } from '@chibi-town/ui/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExecuteFarm } from '@/features/farm/_components/farm-unit-panel';
import { ProductIcon } from './product-icon';

export function InventoryDialog({
  state,
  pending,
  execute,
  onClose,
}: {
  state?: FarmProgress;
  pending: boolean;
  execute: ExecuteFarm;
  onClose: () => void;
}) {
  const { t: common } = useTranslation('common');
  const { t, i18n } = useTranslation('inventory');
  const { t: farm } = useTranslation('farm');
  const chest = 'main' as const;
  const stock = state ? chestInventory(state, chest) : undefined;
  const upgrade = state ? chestUpgradePrice(chest, state.chests[chest]) : null;
  const [tab, setTab] = useState('goods');
  const folderRef = useRef<HTMLDivElement>(null);
  const [folderHeight, setFolderHeight] = useState<number>();
  const [selected, setSelected] = useState<string>();
  const goods = state
    ? Object.entries(FARM_PRODUCTS)
        .filter(([id]) => (stock?.[id as FarmProduct] ?? 0) > 0)
        .map(([id]) => ({
          id,
          label: t(`products.${id as FarmProduct}`),
          count: stock![id as FarmProduct]!,
          icon: <ProductIcon product={id as FarmProduct} />,
        }))
    : [];
  const seeds: InventoryItem[] = state
    ? Object.entries(state.seeds)
        .filter(([, count]) => count && count > 0)
        .map(([id, count]) => ({
          id,
          label: farm('seedLabel', { name: t(`products.${id as CropId}`) }),
          count: count!,
          icon: <span aria-hidden="true">{FARM_CROPS[id as CropId].icon}</span>,
        }))
    : [];
  if (state?.inventory.seed)
    seeds.push({
      id: 'strawberry',
      label: t('seed'),
      count: state.inventory.seed,
      icon: <span aria-hidden="true">🌱</span>,
    });
  const items = tab === 'goods' ? goods : seeds;
  const item = items.find((item) => item.id === selected) ?? items[0];
  return (
    <Dialog
      id="warehouse"
      title={t('title')}
      onClose={onClose}
      closeLabel={common('close')}
      footer={
        <div className="warehouse-footer">
          {item && <p id="warehouse-detail">{t('detail', { name: item.label, count: item.count })}</p>}
          {item && (
            <div className="warehouse-actions">
              {item &&
                tab === 'goods' &&
                FARM_PRODUCTS[item.id as FarmProduct].price !== null &&
                [
                  { id: 'one', count: 1, label: t('sellOne') },
                  { id: 'all', count: item.count, label: t('sellAll') },
                ].map((action) => (
                  <Button
                    key={action.id}
                    disabled={pending}
                    onClick={() =>
                      void execute(
                        { type: 'sell', product: item.id as FarmProduct, count: action.count, chest },
                        {
                          price: 0,
                          title: t('sellConfirm', {
                            count: action.count,
                            name: item.label,
                            coins: action.count * (FARM_PRODUCTS[item.id as FarmProduct].price ?? 0),
                          }),
                        },
                      )
                    }
                  >
                    {action.label}
                  </Button>
                ))}
            </div>
          )}
          {item && tab === 'goods' && FARM_PRODUCTS[item.id as FarmProduct].price === null && (
            <p>{farm('unsettledPrice')}</p>
          )}
          <Button onClick={onClose}>{common('close')}</Button>
        </div>
      }
      tabs={
        <Tabs
          appearance="folder"
          items={[
            { id: 'goods', label: t('goods') },
            { id: 'seeds', label: t('seeds') },
          ]}
          value={tab}
          onChange={(next) => {
            setFolderHeight(folderRef.current?.getBoundingClientRect().height);
            setTab(next);
            setSelected(undefined);
          }}
        />
      }
    >
      {state && (
        <section className="chest-upgrade">
          <p>
            {t('chestInfo', {
              level: state.chests[chest],
              used: occupiedChestSlots(state, chest),
              slots: chestSlots(state, chest),
            })}
          </p>
          {upgrade ? (
            <Button
              disabled={pending || state[upgrade.currency] < upgrade.amount}
              onClick={() =>
                void execute(
                  { type: 'upgrade-chest', chest },
                  {
                    price: upgrade.amount,
                    currency: upgrade.currency,
                    title: t('upgradeChestConfirm', {
                      level: state.chests[chest] + 1,
                      slots: FARM_CHEST_SLOTS[state.chests[chest] as 1 | 2 | 3 | 4 | 5],
                    }),
                  },
                )
              }
            >
              {t('upgradeChest', {
                level: state.chests[chest] + 1,
                price: upgrade.amount.toLocaleString(i18n.language),
                currency: farm(upgrade.currency),
              })}
            </Button>
          ) : (
            <p>{t('chestMax')}</p>
          )}
          {occupiedChestSlots(state, chest) >= chestSlots(state, chest) && <p role="status">{t('chestFull')}</p>}
        </section>
      )}
      <div className="warehouse-folder-body" ref={folderRef} style={{ minHeight: folderHeight }}>
        <div className="warehouse-content">
          {items.length ? (
            <InventoryGrid
              slots={tab === 'goods' && state ? chestSlots(state, chest) : 12}
              items={items}
              selected={item?.id}
              onSelect={setSelected}
            />
          ) : (
            <EmptyState title={t(tab === 'goods' ? 'emptyGoods' : 'emptySeeds')} />
          )}
        </div>
      </div>
    </Dialog>
  );
}
