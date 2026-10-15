import type { Outfit } from '@chibi-town/character-core/character-types';
import {
  COSMETIC_CATALOG,
  COSMETIC_COLOR_IDS,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { families, itemAtLevel, items, petAtLevel } from '@chibi-town/character-core/item-catalog';
import { defaultOutfit, femaleOutfit, outfitFields, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type {
  CharacterInventoryCommand,
  CharacterInventoryPage,
  CharacterInventoryQuery,
} from '@chibi-town/contracts/character-inventory';
import type {
  CharacterCosmeticInstance,
  CosmeticGrant,
  CosmeticGrantSource,
  CosmeticOwnership,
  CosmeticShopOffer,
} from '@chibi-town/game-content/cosmetic-economy';
import { CHARACTER_BAG_SLOTS, COSMETIC_SHOP_PRICES } from '@chibi-town/game-content/cosmetic-shop';
import type { PlayerDocument } from './player-document.js';

export type CharacterInventoryState = {
  version: 1;
  characterId: 'main';
  bagSlots: number;
  instances: Record<string, CharacterCosmeticInstance>;
  unlocks: Record<string, CosmeticOwnership>;
  grants: Record<string, CosmeticGrant>;
};
type Binding = { cosmeticId: CosmeticId; slot: string; colorUnlockId?: `item-color/${string}/${string}` };

function definition(id: string): Readonly<CosmeticDefinition> {
  if (!Object.hasOwn(COSMETIC_CATALOG, id)) throw new ApiSdkError('INVALID_COMMAND');
  return COSMETIC_CATALOG[id as CosmeticId];
}

function bindings(outfit: Outfit): Binding[] {
  const result: Binding[] = [];
  for (const field of outfitFields) {
    if (field.slot && outfit[field.key]) {
      const selected = outfit[field.key];
      const levelField = outfitFields.find((f) => f.levelOf === field.key);
      const level = levelField ? Number(outfit[levelField.key]) : 1;
      const itemId = families[selected] ? itemAtLevel(selected, level) : selected;
      const item = itemId && items[itemId];
      if (
        !item ||
        item.hidden ||
        item.slot !== field.slot ||
        (item.gender && item.gender !== outfit.gender) ||
        (families[selected] && item.level !== level)
      )
        throw new ApiSdkError('NOT_ALLOWED');
      const colorField = outfitFields.find((f) => f.colors === field.slot);
      let colorUnlockId: Binding['colorUnlockId'];
      if (colorField) {
        const colorId = COSMETIC_COLOR_IDS[field.slot]?.[outfit[colorField.key]];
        if (!colorId) throw new ApiSdkError('NOT_ALLOWED');
        colorUnlockId = `item-color/${item.id}/${colorId}`;
      }
      result.push({ cosmeticId: `item/${item.id}`, slot: field.key, colorUnlockId });
    }
  }
  if (outfit.pet) {
    const pet = petAtLevel(outfit.pet, Number(outfit.petLevel));
    if (!pet || (pet.level ?? 1) !== Number(outfit.petLevel)) throw new ApiSdkError('NOT_ALLOWED');
    result.push({ cosmeticId: `pet/${pet.id}`, slot: 'pet' });
  }
  return result;
}

function skinId(outfit: Outfit): CosmeticId {
  return `skin-color/${COSMETIC_COLOR_IDS.skin[outfit.skin]}`;
}

function own(state: CharacterInventoryState, id: string) {
  return Object.hasOwn(state.unlocks, id);
}

function bagSlot(state: CharacterInventoryState): number {
  const used = new Set(
    Object.values(state.instances).flatMap((item) => (item.location.container === 'bag' ? [item.location.slot] : [])),
  );
  for (let slot = 0; slot < state.bagSlots; slot++) if (!used.has(slot)) return slot;
  throw new ApiSdkError('INVENTORY_FULL');
}

/** Trusted entry point for server-verified quest/event rewards. Never exposed as a client grant command. */
export function grantCharacterCosmetics(
  state: CharacterInventoryState,
  grantId: string,
  ids: readonly string[],
  source: CosmeticGrantSource,
  now: number,
) {
  if (Object.hasOwn(state.grants, grantId)) return false;
  if (!grantId || !Number.isSafeInteger(now) || now < 0 || !ids.length || new Set(ids).size !== ids.length)
    throw new ApiSdkError('INVALID_COMMAND');
  const entries = ids.map(definition);
  if (entries.some((entry) => own(state, entry.id))) throw new ApiSdkError('NOT_ALLOWED');
  for (const entry of entries)
    if (entry.kind === 'item-color' && !own(state, entry.requires) && !ids.includes(entry.requires))
      throw new ApiSdkError('NOT_ALLOWED');
  for (const entry of entries) {
    state.unlocks[entry.id] = {
      characterId: state.characterId,
      cosmeticId: entry.id,
      firstGrantId: grantId,
      acquiredAt: now,
    };
    if (entry.kind === 'item' || entry.kind === 'pet') {
      const instanceId = `${grantId}:${entry.id}`;
      let location: CharacterCosmeticInstance['location'];
      try {
        location = { container: 'bag', slot: bagSlot(state) };
      } catch {
        location = { container: 'warehouse' };
      }
      state.instances[instanceId] = {
        instanceId,
        characterId: state.characterId,
        cosmeticId: entry.id as CharacterCosmeticInstance['cosmeticId'],
        firstGrantId: grantId,
        acquiredAt: now,
        location,
      };
    }
  }
  state.grants[grantId] = {
    id: grantId,
    characterId: state.characterId,
    source,
    grantedAt: now,
    reward: { cosmeticIds: [...ids] },
  };
  return true;
}

/** Runs once from a trusted saved outfit, retaining only the exact worn items and palettes. */
export function ensureCharacterInventory(document: PlayerDocument, now: number): CharacterInventoryState {
  if (document.characterInventory) return document.characterInventory;
  const state: CharacterInventoryState = {
    version: 1,
    characterId: 'main',
    bagSlots: CHARACTER_BAG_SLOTS,
    instances: {},
    unlocks: {},
    grants: {},
  };
  const outfit = sanitizeOutfit(document.outfit ?? defaultOutfit);
  const worn = bindings(outfit);
  const ids = [
    ...new Set([
      skinId(outfit),
      ...worn.flatMap((item) => [item.cosmeticId, ...(item.colorUnlockId ? [item.colorUnlockId] : [])]),
    ]),
  ];
  grantCharacterCosmetics(state, 'migration/v1', ids, { kind: 'migration', migrationId: 'v1' }, now);
  for (const item of Object.values(state.instances)) {
    const binding = worn.find((entry) => entry.cosmeticId === item.cosmeticId)!;
    item.location = { container: 'equipped', slot: binding.slot };
    item.colorUnlockId = binding.colorUnlockId;
  }
  document.outfit = outfit;
  document.characterInventory = state;
  return state;
}

export function grantStarterSelection(document: PlayerDocument, outfit: Outfit, now: number) {
  const state = ensureCharacterInventory(document, now);
  if (Object.hasOwn(state.grants, 'starter/selection')) throw new ApiSdkError('NOT_ALLOWED');
  const worn = bindings(outfit);
  const ids = [
    ...new Set([
      skinId(outfit),
      ...worn.flatMap((item) => [item.cosmeticId, ...(item.colorUnlockId ? [item.colorUnlockId] : [])]),
    ]),
  ].filter((id) => !own(state, id));
  if (ids.length)
    grantCharacterCosmetics(state, 'starter/selection', ids, { kind: 'starter', bundleId: 'selection' }, now);
  else
    state.grants['starter/selection'] = {
      id: 'starter/selection',
      characterId: 'main',
      source: { kind: 'starter', bundleId: 'selection' },
      grantedAt: now,
      reward: { cosmeticIds: [] },
    };
  for (const item of Object.values(state.instances)) {
    if (item.location.container === 'equipped') item.location = { container: 'warehouse' };
    const binding = worn.find((entry) => entry.cosmeticId === item.cosmeticId);
    if (binding) {
      item.location = { container: 'equipped', slot: binding.slot };
      item.colorUnlockId = binding.colorUnlockId;
    }
  }
  document.outfit = structuredClone(outfit);
}

function initialColor(entry: Readonly<CosmeticDefinition>): CosmeticId | undefined {
  if (entry.kind !== 'item') return undefined;
  const preset = entry.gender === 'female' ? femaleOutfit : defaultOutfit;
  const field = outfitFields.find((f) => f.colors === entry.slot);
  if (!field) return undefined;
  return `item-color/${entry.itemId}/${COSMETIC_COLOR_IDS[entry.slot][preset[field.key]]}`;
}

export function cosmeticOffer(id: string): CosmeticShopOffer {
  const entry = definition(id);
  const color = initialColor(entry);
  const amount =
    entry.kind === 'item-color'
      ? COSMETIC_SHOP_PRICES.color
      : entry.kind === 'skin-color'
        ? COSMETIC_SHOP_PRICES.skin
        : COSMETIC_SHOP_PRICES[entry.category] * (('level' in entry ? entry.level : 1) ?? 1) ** 2;
  return {
    id: entry.id,
    enabled: true,
    price: { currency: 'coins', amount },
    reward: { cosmeticIds: [entry.id, ...(color ? [color] : [])] },
  };
}

export function equipOwnedOutfit(document: PlayerDocument, requested: Outfit, now: number) {
  const state = ensureCharacterInventory(document, now);
  const checked = sanitizeOutfit(requested);
  if (Object.keys(defaultOutfit).some((key) => checked[key as keyof Outfit] !== requested[key as keyof Outfit]))
    throw new ApiSdkError('NOT_ALLOWED');
  const worn = bindings(checked);
  if (!own(state, skinId(checked))) throw new ApiSdkError('NOT_ALLOWED');
  const chosen = worn.map((binding) => {
    const item = Object.values(state.instances).find((value) => value.cosmeticId === binding.cosmeticId);
    if (
      !item ||
      item.location.container === 'warehouse' ||
      (binding.colorUnlockId && !own(state, binding.colorUnlockId))
    )
      throw new ApiSdkError('NOT_ALLOWED');
    return { item, binding };
  });
  // Plan on a clone: multiple swaps/unequips must all fit before changing any real location.
  const next = structuredClone(state);
  for (const item of Object.values(next.instances))
    if (item.location.container === 'equipped') item.location = { container: 'warehouse' };
  for (const { item, binding } of chosen) {
    next.instances[item.instanceId].location = { container: 'equipped', slot: binding.slot };
    next.instances[item.instanceId].colorUnlockId = binding.colorUnlockId;
  }
  for (const item of Object.values(state.instances))
    if (item.location.container === 'equipped' && next.instances[item.instanceId].location.container !== 'equipped')
      next.instances[item.instanceId].location = { container: 'bag', slot: bagSlot(next) };
  document.characterInventory = next;
  document.outfit = checked;
}

export function executeCharacterInventory(
  document: PlayerDocument,
  command: CharacterInventoryCommand,
  requestId: string,
  now: number,
) {
  const state = ensureCharacterInventory(document, now);
  if (command.type === 'buy-cosmetic') {
    const offer = cosmeticOffer(command.offerId);
    const ids = offer.reward.cosmeticIds.filter((id) => !own(state, id));
    if (own(state, command.offerId)) throw new ApiSdkError('NOT_ALLOWED');
    if (document.farm.coins < offer.price.amount) throw new ApiSdkError('INSUFFICIENT_COINS');
    grantCharacterCosmetics(state, `shop/${requestId}`, ids, { kind: 'shop', offerId: offer.id }, now);
    document.farm.coins -= offer.price.amount;
    return;
  }
  if (command.type === 'apply-cosmetic-color') {
    const entry = definition(command.cosmeticId);
    if (!own(state, entry.id)) throw new ApiSdkError('NOT_ALLOWED');
    const next = structuredClone(document.outfit ?? defaultOutfit);
    if (entry.kind === 'skin-color') next.skin = entry.colorValue;
    else if (entry.kind === 'item-color') {
      const item = Object.values(state.instances).find(
        (value) => value.cosmeticId === entry.requires && value.location.container === 'equipped',
      );
      const field = outfitFields.find((value) => value.colors === entry.slot);
      if (!item || !field) throw new ApiSdkError('NOT_ALLOWED');
      next[field.key] = entry.colorValue;
    } else throw new ApiSdkError('INVALID_COMMAND');
    equipOwnedOutfit(document, next, now);
    return;
  }
  if (!Object.hasOwn(state.instances, command.instanceId)) throw new ApiSdkError('NOT_ALLOWED');
  const item = state.instances[command.instanceId];
  const entry = definition(item.cosmeticId);
  if (command.type === 'move-character-item') {
    if (item.location.container === 'equipped' || item.location.container === command.to)
      throw new ApiSdkError('NOT_ALLOWED');
    item.location = command.to === 'bag' ? { container: 'bag', slot: bagSlot(state) } : { container: 'warehouse' };
    return;
  }
  const next = structuredClone(document.outfit ?? defaultOutfit);
  if (entry.kind === 'pet') {
    if (command.type === 'unequip-character-item') next.pet = '';
    else {
      next.pet = entry.family ?? entry.petId;
      next.petLevel = String(entry.level ?? 1);
    }
  } else if (entry.kind === 'item') {
    const field = outfitFields.find((value) => value.slot === entry.slot);
    if (!field) throw new ApiSdkError('NOT_ALLOWED');
    if (command.type === 'unequip-character-item') {
      if (!field.optional) throw new ApiSdkError('NOT_ALLOWED');
      next[field.key] = '';
    } else {
      next[field.key] = entry.family ?? entry.itemId;
      const levelField = outfitFields.find((value) => value.levelOf === field.key);
      if (levelField) next[levelField.key] = String(entry.level ?? 1);
      const colorField = outfitFields.find((value) => value.colors === entry.slot);
      if (colorField) {
        const color = item.colorUnlockId ?? initialColor(entry);
        const palette = color && definition(color);
        if (!palette || palette.kind !== 'item-color') throw new ApiSdkError('NOT_ALLOWED');
        next[colorField.key] = palette.colorValue;
      }
    }
  } else throw new ApiSdkError('NOT_ALLOWED');
  if (command.type === 'unequip-character-item' && item.location.container !== 'equipped')
    throw new ApiSdkError('NOT_ALLOWED');
  equipOwnedOutfit(document, next, now);
}

export function characterInventoryPage(
  document: PlayerDocument,
  query: CharacterInventoryQuery,
  now: number,
): CharacterInventoryPage {
  const state = ensureCharacterInventory(document, now);
  let definitions = Object.values(COSMETIC_CATALOG).filter(
    (entry) =>
      (!query.category || entry.category === query.category) &&
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
  const rows = definitions
    .flatMap((entry) => {
      const item = instanceByCosmetic.get(entry.id as CharacterCosmeticInstance['cosmeticId']);
      if (query.view !== 'shop' && item?.location.container !== query.view) return [];
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
          canBuy: !own(state, entry.id) && (entry.kind !== 'item-color' || own(state, entry.requires)),
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
