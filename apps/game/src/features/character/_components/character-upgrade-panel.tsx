import { COSMETIC_INDEX } from '@chibi-town/character-core/cosmetic-index';
import type { CharacterInventoryPage, CharacterInventoryRow } from '@chibi-town/contracts/character-inventory';
import { Button, Tabs } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppImage } from '@/application/_components/app-image';
import { publicAssetUrls } from '@/assets/generated-assets';
import { CharacterPreview } from '@/features/character/_components/character-preview';
import { CosmeticThumbnail } from '@/features/character/_components/cosmetic-thumbnail';
import { upgradePreview } from '@/features/character/_utils/upgrade-preview';

export function CharacterUpgradePanel({
  page,
  selected,
  pending,
  onSelect,
  layout = 'cards',
}: {
  layout?: 'cards' | 'sidebar';
  currency?: 'coins' | 'gems';
  page: CharacterInventoryPage;
  selected?: string;
  pending: boolean;
  onSelect(id: string): void;
}) {
  const { t } = useTranslation('inventory');
  const { t: jeweler } = useTranslation('jeweler');
  const [preview, setPreview] = useState<{ sourceId: string; id: string }>();
  const row = page.rows.find((row) => row.definition.id === selected) ?? page.rows[0];
  const offer = row?.upgrade;
  const target = offer?.target;
  const levels = row
    ? COSMETIC_INDEX.select({ groupId: row.definition.groupId })
        .filter((item) => item.kind === 'item' || item.kind === 'pet')
        .sort((a, b) => ('level' in a ? (a.level ?? 1) : 1) - ('level' in b ? (b.level ?? 1) : 1))
    : [];
  const previewLevel =
    levels.find((level) => preview?.sourceId === row?.definition.id && level.id === preview.id) ??
    target ??
    row?.definition;
  return (
    <section className={`character-upgrades${layout === 'sidebar' ? ' is-sidebar' : ''}`} aria-busy={pending}>
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
          <section className="character-upgrade-levels" aria-label={jeweler('previewLevels')}>
            <Tabs
              label={jeweler('previewLevels')}
              items={levels.map((level) => ({
                id: level.id,
                label: jeweler('previewLevel', { level: 'level' in level ? (level.level ?? 1) : 1 }),
              }))}
              value={previewLevel?.id ?? row.definition.id}
              onChange={(id) => setPreview({ sourceId: row.definition.id, id })}
            />
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
                <small>{previewLevel?.id === target?.id ? t('character.upgrade.next') : jeweler('previewOnly')}</small>
                <CharacterPreview
                  outfit={upgradePreview(page.outfit, previewLevel ?? row.definition, row.instance?.colorUnlockId)}
                  label={(previewLevel ?? row.definition).label}
                />
                <strong>{(previewLevel ?? row.definition).label}</strong>
              </div>
            </div>
          </section>
          <div className="character-upgrade-summary">
            {target && offer && (
              <>
                <div className="character-upgrade-materials">
                  {offer.materials.map((m) => (
                    <div key={m.materialId} className={m.owned < m.count ? 'is-missing' : ''}>
                      <AppImage
                        src={publicAssetUrls[`jeweler/${m.materialId}.webp`]}
                        width={36}
                        height={36}
                        alt=""
                        aria-hidden="true"
                      />
                      <span>{jeweler(`materials.${m.materialId}`)}</span>
                      <strong>{jeweler('materialCount', { owned: m.owned, count: m.count })}</strong>
                    </div>
                  ))}
                </div>
              </>
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
  currency = 'coins',
}: {
  page: CharacterInventoryPage;
  selected?: string;
  pending: boolean;
  onUpgrade(row: CharacterInventoryRow): void;
  currency?: 'coins' | 'gems';
}) {
  const { t, i18n } = useTranslation('inventory');
  const { t: jeweler } = useTranslation('jeweler');
  const [confirming, setConfirming] = useState(false);
  const row = page.rows.find((row) => row.definition.id === selected) ?? page.rows[0];
  const offer = row?.upgrade;
  const target = offer?.target;
  const available = currency === 'gems' ? page.gems : (page.availableCoins ?? page.coins);
  const price = currency === 'gems' ? offer?.gemPrice : offer?.price.amount;
  const missing = offer?.materials.some((m) => m.owned < m.count);
  if (!row || !offer || !target || price == null) return null;
  return (
    <div className="character-upgrade-action">
      {target ? (
        <>
          <Button
            variant="primary"
            disabled={pending || offer.owned || available < price || missing}
            onClick={() => (confirming ? onUpgrade(row) : setConfirming(true))}
          >
            {offer.owned
              ? t('character.upgrade.alreadyOwned')
              : jeweler(confirming ? 'confirmAttempt' : 'attempt', {
                  level: 'level' in target ? (target.level ?? 1) : 1,
                  price: price.toLocaleString(i18n.language),
                  currency: jeweler(currency === 'gems' ? 'gemUnit' : 'coinUnit'),
                })}
          </Button>
          {confirming && (
            <>
              <Button disabled={pending} onClick={() => setConfirming(false)}>
                {jeweler('cancel')}
              </Button>
            </>
          )}
          {missing && <small role="status">{jeweler('missingMaterials')}</small>}
          {available < price && !offer.owned && (
            <small role="status">{jeweler(currency === 'gems' ? 'insufficientGems' : 'insufficient')}</small>
          )}
        </>
      ) : (
        <strong>{t('character.upgrade.maximum')}</strong>
      )}
    </div>
  );
}
