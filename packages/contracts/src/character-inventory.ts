import type { Outfit } from '@chibi-town/character-core/character-types';
import {
  COSMETIC_CATALOG,
  type CosmeticCategory,
  type CosmeticDefinition,
} from '@chibi-town/character-core/cosmetic-catalog';
import { COSMETIC_INDEX } from '@chibi-town/character-core/cosmetic-index';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { CharacterCosmeticInstance, CosmeticShopOffer } from '@chibi-town/game-content/cosmetic-economy';
import { COSMETIC_SHOP_IDS, type CosmeticShopId } from '@chibi-town/game-content/cosmetic-shop';
import { ApiSdkError } from './index.js';

export type CharacterInventoryQuery = {
  view: 'bag' | 'equipped' | 'warehouse' | 'shop' | 'owned' | 'unequipped';
  category?: CosmeticCategory;
  slot?: string;
  groupId?: string;
  shop?: CosmeticShopId;
  cursor?: string;
  limit?: number;
};
export type CharacterInventoryRow = {
  definition: Readonly<CosmeticDefinition>;
  owned: boolean;
  canBuy: boolean;
  canApply: boolean;
  canUnequip: boolean;
  instance?: CharacterCosmeticInstance;
  offer?: CosmeticShopOffer;
};
export type CharacterInventoryPage = {
  characterId: string;
  revision: number;
  rows: CharacterInventoryRow[];
  nextCursor: string | null;
  total: number;
  bagSlots: number;
  bagUsed: number;
  coins: number;
  gems: number;
  outfit: Outfit;
};
export type CharacterInventoryCommand =
  | { type: 'buy-cosmetic'; offerId: string }
  | { type: 'move-character-item'; instanceId: string; to: 'bag' | 'warehouse' }
  | { type: 'equip-character-item'; instanceId: string }
  | { type: 'unequip-character-item'; instanceId: string }
  | { type: 'apply-cosmetic-color'; cosmeticId: string };

export function validateCharacterInventoryQuery(query: CharacterInventoryQuery) {
  if (
    !query ||
    !['bag', 'equipped', 'warehouse', 'shop', 'owned', 'unequipped'].includes(query.view) ||
    (query.category !== undefined && !['equipment', 'appearance', 'pet'].includes(query.category)) ||
    (query.shop !== undefined && !COSMETIC_SHOP_IDS.includes(query.shop)) ||
    [query.groupId, query.cursor, query.slot].some(
      (value) => value !== undefined && (typeof value !== 'string' || value.length > 256),
    ) ||
    (query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 50)) ||
    (query.slot !== undefined && !COSMETIC_INDEX.hasSlot(query.slot))
  )
    throw new ApiSdkError('INVALID_COMMAND');
}

export function decodeCharacterInventoryPage(value: unknown): CharacterInventoryPage {
  const page = value as CharacterInventoryPage;

  const safe = (number: number) => Number.isSafeInteger(number) && number >= 0;

  if (
    !page ||
    page.characterId !== 'main' ||
    !safe(page.revision) ||
    !Array.isArray(page.rows) ||
    page.rows.length > 50 ||
    !safe(page.total) ||
    !safe(page.bagSlots) ||
    !safe(page.bagUsed) ||
    page.bagUsed > page.bagSlots ||
    !safe(page.coins) ||
    !safe(page.gems) ||
    (page.nextCursor !== null && typeof page.nextCursor !== 'string') ||
    !page.outfit ||
    typeof page.outfit !== 'object' ||
    Object.keys(defaultOutfit).some((key) => typeof page.outfit[key as keyof Outfit] !== 'string') ||
    page.rows.some(
      (row) =>
        !row ||
        !row.definition ||
        !Object.hasOwn(COSMETIC_CATALOG, row.definition.id) ||
        typeof row.owned !== 'boolean' ||
        typeof row.canBuy !== 'boolean' ||
        typeof row.canApply !== 'boolean' ||
        typeof row.canUnequip !== 'boolean' ||
        (row.offer !== undefined &&
          (!row.offer ||
            row.offer.id !== row.definition.id ||
            !COSMETIC_SHOP_IDS.includes(row.offer.shop) ||
            typeof row.offer.enabled !== 'boolean' ||
            !row.offer.price ||
            !safe(row.offer.price.amount) ||
            row.offer.price.amount === 0 ||
            !['coins', 'gems'].includes(row.offer.price.currency))) ||
        (row.instance !== undefined &&
          (!row.instance ||
            row.instance.characterId !== page.characterId ||
            row.instance.cosmeticId !== row.definition.id ||
            typeof row.instance.instanceId !== 'string' ||
            !row.instance.location ||
            !['bag', 'equipped', 'warehouse'].includes(row.instance.location.container))),
    )
  )
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid character inventory response');
  return page;
}
