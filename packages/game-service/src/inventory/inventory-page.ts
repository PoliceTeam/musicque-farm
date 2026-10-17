import { COSMETIC_CATALOG, type CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { defaultOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterInventoryPage, CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { CharacterCosmeticInstance } from '@chibi-town/game-content/cosmetic-economy';
import { skinId } from '../character/outfit-bindings.js';
import type { PlayerDocument } from '../player-document.js';
import { cosmeticOffer, cosmeticShop, isBaseCosmetic } from '../shop/cosmetic-offers.js';
import { ensureCharacterInventory } from './cosmetic-grants.js';
import { own } from './inventory-state.js';

export function characterInventoryPage(
  document: PlayerDocument,
  query: CharacterInventoryQuery,
  now: number,
): CharacterInventoryPage {
  const state = ensureCharacterInventory(document, now);
  let definitions = Object.values(COSMETIC_CATALOG).filter(
    (entry) =>
      (!query.category || entry.category === query.category) &&
      (!query.shop || cosmeticShop(entry) === query.shop) &&
      (query.view !== 'shop' ||
        (isBaseCosmetic(entry) &&
          (!query.shop ||
            !('gender' in entry) ||
            !entry.gender ||
            entry.gender === (document.outfit ?? defaultOutfit).gender))) &&
      (!query.slot || ('slot' in entry && entry.slot === query.slot)) &&
      (!query.groupId || entry.groupId === query.groupId) &&
      (query.view !== 'shop' ||
        query.groupId ||
        entry.kind === 'item' ||
        entry.kind === 'pet' ||
        entry.kind === 'skin-color'),
  );
  if (query.view === 'shop' && !query.groupId) {
    const groups = new Map<string, Readonly<CosmeticDefinition>>();
    for (const entry of definitions) {
      const previous = groups.get(entry.groupId);
      if (!previous || (('level' in entry ? entry.level : 1) ?? 1) < (('level' in previous ? previous.level : 1) ?? 1))
        groups.set(entry.groupId, entry);
    }
    definitions = [...groups.values()];
  }
  const instanceByCosmetic = new Map(Object.values(state.instances).map((item) => [item.cosmeticId, item]));
  const worn = new Set<string>([skinId(document.outfit ?? defaultOutfit)]);
  for (const item of Object.values(state.instances)) {
    if (item.location.container !== 'equipped') continue;
    worn.add(item.cosmeticId);
    if (item.colorUnlockId) worn.add(item.colorUnlockId);
  }
  const rows = definitions
    .flatMap((entry) => {
      const item = instanceByCosmetic.get(entry.id as CharacterCosmeticInstance['cosmeticId']);
      if (
        query.view === 'owned' || query.view === 'unequipped'
          ? !own(state, entry.id) || (query.view === 'unequipped' && worn.has(entry.id))
          : query.view !== 'shop' && item?.location.container !== query.view
      )
        return [];
      return [
        {
          definition: entry,
          owned: own(state, entry.id),
          canUnequip:
            item?.location.container === 'equipped' &&
            (entry.kind === 'pet' ||
              (entry.kind === 'item' && outfitFields.some((field) => field.slot === entry.slot && field.optional))),
          canApply:
            own(state, entry.id) &&
            (entry.kind === 'skin-color' ||
              (entry.kind === 'item-color' &&
                instanceByCosmetic.get(entry.requires as CharacterCosmeticInstance['cosmeticId'])?.location
                  .container === 'equipped')),
          canBuy:
            isBaseCosmetic(entry) &&
            !own(state, entry.id) &&
            (entry.kind !== 'item-color' || own(state, entry.requires)),
          ...(item ? { instance: structuredClone(item) } : {}),
          ...(query.view === 'shop' ? { offer: cosmeticOffer(entry.id) } : {}),
        },
      ];
    })
    .sort((a, b) => a.definition.id.localeCompare(b.definition.id, 'en'));
  const after = query.cursor ? rows.findIndex((row) => row.definition.id === query.cursor) + 1 : 0;
  if (query.cursor && !after) throw new ApiSdkError('INVALID_COMMAND');
  const limit = query.limit ?? 24;
  const page = rows.slice(after, after + limit);
  return {
    characterId: state.characterId,
    revision: document.revision,
    rows: page,
    nextCursor: after + limit < rows.length ? page.at(-1)!.definition.id : null,
    total: rows.length,
    bagSlots: state.bagSlots,
    bagUsed: Object.values(state.instances).filter((item) => item.location.container === 'bag').length,
    coins: document.farm.coins,
    gems: document.farm.gems,
    outfit: structuredClone(document.outfit ?? defaultOutfit),
  };
}
