import type { CosmeticId } from '@chibi-town/character-core/cosmetic-catalog';
import type { CharacterInventoryRow } from '@chibi-town/contracts/character-inventory';
import { Button } from '@chibi-town/ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';

/** Permanent palettes are item details, never additional physical items in the basket. */
export function OwnedItemColors({
  item,
  pending,
  onApply,
}: {
  item: CharacterInventoryRow;
  pending: boolean;
  onApply(id: CosmeticId): void;
}) {
  const { t } = useTranslation('inventory');
  const [colors, setColors] = useState<CharacterInventoryRow[]>([]);
  const id = item.definition.id,
    groupId = item.definition.groupId;
  const physical = item.definition.kind === 'item' && !!item.instance;
  useEffect(() => {
    let cancelled = false;
    setColors([]);
    if (!physical) return;
    void (async () => {
      const result: CharacterInventoryRow[] = [];
      let cursor: string | undefined;
      do {
        const page = await getApiSdk().getCharacterInventory({ view: 'owned', groupId, limit: 50, cursor });
        if (cancelled) return;
        result.push(
          ...page.rows.filter((row) => row.definition.kind === 'item-color' && row.definition.requires === id),
        );
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      setColors(result);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, groupId, physical]);
  if (!colors.length) return null;
  return (
    <div className="character-owned-colors">
      <span>{t('character.ownedColors')}</span>
      {colors.map((color) => (
        <Button
          key={color.definition.id}
          disabled={pending || item.instance?.location.container !== 'equipped'}
          aria-pressed={item.instance?.colorUnlockId === color.definition.id}
          onClick={() => onApply(color.definition.id)}
        >
          {color.definition.label}
        </Button>
      ))}
    </div>
  );
}

/** Skin palettes remain usable from Information after removing permanent unlocks from the physical basket. */
export function OwnedSkinColors({
  selected,
  pending,
  onApply,
}: {
  selected?: string;
  pending: boolean;
  onApply(id: CosmeticId): void;
}) {
  const { t } = useTranslation('inventory');
  const [colors, setColors] = useState<CharacterInventoryRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    void getApiSdk()
      .getCharacterInventory({ view: 'owned', groupId: 'appearance/skin', limit: 50 })
      .then((page) => {
        if (!cancelled) setColors(page.rows.filter((row) => row.definition.kind === 'skin-color'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!colors.length) return null;
  return (
    <div className="character-owned-colors">
      <span>{t('character.ownedSkinColors')}</span>
      {colors.map((color) => (
        <Button
          key={color.definition.id}
          disabled={pending}
          aria-pressed={color.definition.kind === 'skin-color' && color.definition.colorValue === selected}
          onClick={() => onApply(color.definition.id)}
        >
          {color.definition.label}
        </Button>
      ))}
    </div>
  );
}
