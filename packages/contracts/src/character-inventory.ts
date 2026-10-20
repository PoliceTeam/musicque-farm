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
import { JEWELER_MATERIALS, type JewelerMaterialId } from '@chibi-town/game-content/jeweler';
import { ApiSdkError } from './index.js';

export type CharacterInventoryQuery = {
  view: 'bag' | 'equipped' | 'warehouse' | 'shop' | 'owned' | 'unequipped' | 'upgrades';
  category?: CosmeticCategory;
  slot?: string;
  groupId?: string;
  shop?: CosmeticShopId;
  cursor?: string;
  limit?: number;
};
export type CosmeticUpgradeOffer = {
  target: Readonly<CosmeticDefinition> | null;
  price: { currency: 'coins'; amount: number };
  recipeVersion: number;
  materials: { materialId: JewelerMaterialId; count: number; owned: number }[];
  gemPrice: number | null;
  chance: number;
  failures: number;
  guaranteeAt: number | null;
  owned: boolean;
  maxLevel: number;
};
export type CosmeticUpgradeResult = {
  recipeVersion: number;
  from: string;
  to: string;
  success: boolean;
  guaranteed: boolean;
  chance: number;
  failuresBefore: number;
  failuresAfter: number;
  guaranteeAt: number | null;
  paid: { currency: 'coins' | 'gems'; amount: number };
  materials: { materialId: JewelerMaterialId; count: number }[];
};

export function validUpgradeResult(value: CosmeticUpgradeResult) {
  return (
    !!value &&
    Number.isSafeInteger(value.recipeVersion) &&
    value.recipeVersion > 0 &&
    Object.hasOwn(COSMETIC_CATALOG, value.from) &&
    Object.hasOwn(COSMETIC_CATALOG, value.to) &&
    typeof value.success === 'boolean' &&
    typeof value.guaranteed === 'boolean' &&
    Number.isFinite(value.chance) &&
    value.chance >= 0 &&
    value.chance <= 100 &&
    [value.failuresBefore, value.failuresAfter].every((n) => Number.isSafeInteger(n) && n >= 0) &&
    (value.guaranteeAt === null || (Number.isSafeInteger(value.guaranteeAt) && value.guaranteeAt > 0)) &&
    !!value.paid &&
    ['coins', 'gems'].includes(value.paid.currency) &&
    Number.isSafeInteger(value.paid.amount) &&
    value.paid.amount > 0 &&
    Array.isArray(value.materials) &&
    value.materials.length > 0 &&
    value.materials.length <= 8 &&
    value.materials.every(
      (m) =>
        !!m && JEWELER_MATERIALS.some((s) => s.id === m.materialId) && Number.isSafeInteger(m.count) && m.count > 0,
    )
  );
}

export type CharacterInventoryRow = {
  upgrade?: CosmeticUpgradeOffer;
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
  availableCoins?: number;
  gems: number;
  outfit: Outfit;
};
export type CharacterInventoryCommand =
  | { type: 'buy-cosmetic'; offerId: string }
  | {
      type: 'upgrade-character-item';
      instanceId: string;
      targetId: string;
      currency: 'coins' | 'gems';
      recipeVersion: number;
    }
  | { type: 'move-character-item'; instanceId: string; to: 'bag' | 'warehouse' }
  | { type: 'equip-character-item'; instanceId: string }
  | { type: 'unequip-character-item'; instanceId: string }
  | { type: 'apply-cosmetic-color'; cosmeticId: string };

export function validateCharacterInventoryQuery(query: CharacterInventoryQuery) {
  if (
    !query ||
    !['bag', 'equipped', 'warehouse', 'shop', 'owned', 'unequipped', 'upgrades'].includes(query.view) ||
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
    (page.availableCoins !== undefined && (!safe(page.availableCoins) || page.availableCoins > page.coins)) ||
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
        (row.upgrade !== undefined &&
          (!row.upgrade ||
            !row.upgrade.price ||
            row.upgrade.price.currency !== 'coins' ||
            !safe(row.upgrade.price.amount) ||
            !safe(row.upgrade.maxLevel) ||
            !safe(row.upgrade.recipeVersion) ||
            row.upgrade.recipeVersion < 1 ||
            !Array.isArray(row.upgrade.materials) ||
            row.upgrade.materials.length > 8 ||
            row.upgrade.materials.some(
              (m) =>
                !m ||
                !JEWELER_MATERIALS.some((s) => s.id === m.materialId) ||
                !safe(m.count) ||
                m.count < 1 ||
                !safe(m.owned),
            ) ||
            (row.upgrade.gemPrice !== null && !safe(row.upgrade.gemPrice)) ||
            !safe(row.upgrade.chance) ||
            row.upgrade.chance > 100 ||
            !safe(row.upgrade.failures) ||
            (row.upgrade.guaranteeAt !== null && (!safe(row.upgrade.guaranteeAt) || row.upgrade.guaranteeAt < 1)) ||
            typeof row.upgrade.owned !== 'boolean' ||
            (row.upgrade.target !== null &&
              (!row.upgrade.target ||
                !Object.hasOwn(COSMETIC_CATALOG, row.upgrade.target.id) ||
                row.upgrade.target.groupId !== row.definition.groupId ||
                row.upgrade.price.amount < 1)))) ||
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
