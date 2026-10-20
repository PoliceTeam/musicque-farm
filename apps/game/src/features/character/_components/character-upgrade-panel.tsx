import type { CharacterInventoryPage, CharacterInventoryRow } from '@chibi-town/contracts/character-inventory';
import { Button } from '@chibi-town/ui/react';
import { useTranslation } from 'react-i18next';
import { CharacterPreview } from '@/features/character/_components/character-preview';
import { CosmeticThumbnail } from '@/features/character/_components/cosmetic-thumbnail';
import { upgradePreview } from '@/features/character/_utils/upgrade-preview';

export function CharacterUpgradePanel({
  page,
  selected,
  pending,
  onSelect,
}: {
  page: CharacterInventoryPage;
  selected?: string;
  pending: boolean;
  onSelect(id: string): void;
}) {
  const { t, i18n } = useTranslation('inventory');
  const row = page.rows.find((row) => row.definition.id === selected) ?? page.rows[0];
  const offer = row?.upgrade;
  const target = offer?.target;
  const available = page.availableCoins ?? page.coins;
  return (
    <section className="character-upgrades" aria-busy={pending}>
      <div className="character-upgrade-heading">
        <h3>{t('character.upgrades')}</h3>
        <strong>{t('character.upgrade.balance', { amount: available.toLocaleString(i18n.language) })}</strong>
      </div>
      <p className="character-upgrade-intro">{t('character.upgrade.intro')}</p>
      {!row ? (
        <p className="character-upgrade-empty">{t('character.upgrade.empty')}</p>
      ) : (
        <>
          <fieldset className="character-upgrade-picker" aria-label={t('character.upgrade.choose')}>
            {page.rows.map((item) => (
              <button
                type="button"
                key={item.definition.id}
                disabled={pending}
                aria-pressed={row.definition.id === item.definition.id}
                onClick={() => onSelect(item.definition.id)}
              >
                <CosmeticThumbnail definition={item.definition} colorUnlockId={item.instance?.colorUnlockId} />
                <span>{item.definition.label}</span>
              </button>
            ))}
          </fieldset>
          <div className="character-upgrade-comparison">
            <div>
              <small>{t('character.upgrade.current')}</small>
              <CharacterPreview
                outfit={upgradePreview(page.outfit, row.definition, row.instance?.colorUnlockId)}
                label={row.definition.label}
              />
              <strong>{row.definition.label}</strong>
            </div>
            <span className="character-upgrade-arrow" aria-hidden="true">
              →
            </span>
            <div className="is-next">
              <small>{t(target ? 'character.upgrade.next' : 'character.upgrade.maximum')}</small>
              <CharacterPreview
                outfit={upgradePreview(page.outfit, target ?? row.definition, row.instance?.colorUnlockId)}
                label={(target ?? row.definition).label}
              />
              <strong>{(target ?? row.definition).label}</strong>
            </div>
          </div>
          <div className="character-upgrade-summary">
            <span className="character-upgrade-guarantee">{t('character.upgrade.guaranteed')}</span>
            <p>{t('character.upgrade.keep')}</p>
            {target && (
              <p>
                {t(
                  row.instance?.location.container === 'equipped'
                    ? 'character.upgrade.equipped'
                    : row.instance?.location.container === 'warehouse'
                      ? 'character.upgrade.warehouse'
                      : 'character.upgrade.bag',
                )}
              </p>
            )}
            {!target && <strong>{t('character.upgrade.maximum')}</strong>}
          </div>
        </>
      )}
    </section>
  );
}

export function CharacterUpgradeAction({
  page,
  selected,
  pending,
  onUpgrade,
}: {
  page: CharacterInventoryPage;
  selected?: string;
  pending: boolean;
  onUpgrade(row: CharacterInventoryRow): void;
}) {
  const { t, i18n } = useTranslation('inventory');
  const row = page.rows.find((row) => row.definition.id === selected) ?? page.rows[0];
  const offer = row?.upgrade;
  const target = offer?.target;
  const available = page.availableCoins ?? page.coins;
  if (!row || !offer || !target) return null;
  return (
    <div className="character-upgrade-action">
      {target ? (
        <>
          <Button
            variant="primary"
            disabled={pending || offer.owned || available < offer.price.amount}
            onClick={() => onUpgrade(row)}
          >
            {offer.owned
              ? t('character.upgrade.alreadyOwned')
              : t('character.upgrade.confirm', {
                  level: 'level' in target ? (target.level ?? 1) : 1,
                  price: offer.price.amount.toLocaleString(i18n.language),
                })}
          </Button>
          {available < offer.price.amount && !offer.owned && (
            <small role="status">{t('character.upgrade.insufficient')}</small>
          )}
        </>
      ) : (
        <strong>{t('character.upgrade.maximum')}</strong>
      )}
    </div>
  );
}
