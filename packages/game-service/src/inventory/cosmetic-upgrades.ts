import {
  COSMETIC_CATALOG,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { COSMETIC_INDEX } from '@chibi-town/character-core/cosmetic-index';
import { defaultOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CosmeticUpgradeOffer, CosmeticUpgradeResult } from '@chibi-town/contracts/character-inventory';
import { cosmeticUpgradeRecipe } from '@chibi-town/game-content/cosmetic-upgrades';
import { LUCKY_EXCLUSIVE_ITEMS } from '@chibi-town/game-content/lucky-draw';
import { initialColor } from '../character/outfit-bindings.js';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import { ensureCharacterInventory, grantCharacterCosmetics } from './cosmetic-grants.js';
import { bagSlot, type CharacterInventoryState, definition, own } from './inventory-state.js';

/** Catalog group membership determines the next level; IDs and prices are never supplied by the client. */
export function cosmeticUpgradeOffer(
  state: CharacterInventoryState,
  entry: Readonly<CosmeticDefinition>,
  document: PlayerDocument,
): CosmeticUpgradeOffer | undefined {
  if ((entry.kind !== 'item' && entry.kind !== 'pet') || !entry.family || !entry.level) return undefined;
  const levels = COSMETIC_INDEX.select({ groupId: entry.groupId })
    .filter((candidate) => candidate.kind === entry.kind && 'level' in candidate && candidate.level)
    .sort((a, b) => ('level' in a ? a.level! : 0) - ('level' in b ? b.level! : 0));
  if (levels.length < 2) return undefined;
  const target = levels.find((candidate) => 'level' in candidate && candidate.level! > entry.level!);
  const recipe = cosmeticUpgradeRecipe(entry.groupId, target && 'level' in target ? target.level! : entry.level);
  if (!recipe) return undefined;
  // Reward-only targets cannot become purchasable through an upgrade route.
  if (
    target &&
    (('level' in target && target.level !== entry.level + 1) || LUCKY_EXCLUSIVE_ITEMS.some((id) => id === target.id))
  )
    return undefined;
  return {
    target: target ?? null,
    price: { currency: 'coins', amount: target ? recipe.coins : 0 },
    recipeVersion: recipe.version,
    materials: target
      ? recipe.materials.map((m) => ({ ...m, owned: document.jeweler?.materials[m.materialId] ?? 0 }))
      : [],
    gemPrice: recipe.gems === null ? null : target ? recipe.gems : 0,
    chance: recipe.chance,
    failures:
      document.upgradeFailures?.[`${entry.groupId}/${target && 'level' in target ? target.level : entry.level}`] ?? 0,
    guaranteeAt: recipe.guaranteeAt,
    owned: !!target && own(state, target.id),
    maxLevel: Math.max(...levels.map((candidate) => ('level' in candidate ? candidate.level! : 1))),
  };
}

export function upgradeCharacterItem(
  document: PlayerDocument,
  instanceId: string,
  targetId: string,
  requestId: string,
  now: number,
  currency: 'coins' | 'gems',
  recipeVersion: number,
  random?: () => number,
): CosmeticUpgradeResult {
  const state = ensureCharacterInventory(document, now);
  const source = Object.hasOwn(state.instances, instanceId) ? state.instances[instanceId] : undefined;
  if (!source || !own(state, source.cosmeticId)) throw new ApiSdkError('NOT_ALLOWED', undefined, 'INSTANCE_NOT_OWNED');
  const entry = definition(source.cosmeticId);
  const offer = cosmeticUpgradeOffer(state, entry, document);
  if (!offer?.target || offer.target.id !== targetId || offer.owned)
    throw new ApiSdkError('NOT_ALLOWED', undefined, 'UPGRADE_UNAVAILABLE');
  if (offer.recipeVersion !== recipeVersion) throw new ApiSdkError('NOT_ALLOWED', undefined, 'RECIPE_CHANGED');
  const amount = currency === 'coins' ? offer.price.amount : offer.gemPrice;
  if (amount === null) throw new ApiSdkError('NOT_ALLOWED', undefined, 'CURRENCY_UNAVAILABLE');
  const balance = currency === 'coins' ? document.farm.coins - reservedArcadeCoins(document) : document.farm.gems;
  if (balance < amount) throw new ApiSdkError(currency === 'coins' ? 'INSUFFICIENT_COINS' : 'INSUFFICIENT_GEMS');
  if (offer.materials.some((m) => m.owned < m.count)) throw new ApiSdkError('NOT_ENOUGH_MATERIALS');
  const guaranteed = offer.guaranteeAt !== null && offer.failures + 1 >= offer.guaranteeAt;
  const chance = guaranteed ? 100 : offer.chance + (currency === 'gems' ? 10 : 0);
  const roll = guaranteed ? 0 : (random?.() ?? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new ApiSdkError('INVALID_COMMAND');
  const success = guaranteed || roll * 100 < chance;
  const result: CosmeticUpgradeResult = {
    recipeVersion,
    from: entry.id,
    to: offer.target.id,
    success,
    guaranteed,
    chance,
    failuresBefore: offer.failures,
    failuresAfter: success ? 0 : Math.min(Number.MAX_SAFE_INTEGER, offer.failures + 1),
    guaranteeAt: offer.guaranteeAt,
    paid: { currency, amount },
    materials: offer.materials.map(({ materialId, count }) => ({ materialId, count })),
  };
  const holdings = { ...document.jeweler?.materials };
  for (const material of offer.materials) holdings[material.materialId] = material.owned - material.count;
  document.jeweler = { materials: holdings, receipts: document.jeweler?.receipts ?? {} };
  document.farm[currency] -= amount;
  document.upgradeFailures ??= {};
  const progressKey = `${entry.groupId}/${'level' in offer.target ? offer.target.level : 1}`;
  if (success) delete document.upgradeFailures[progressKey];
  else document.upgradeFailures[progressKey] = result.failuresAfter;
  if (!success) return result;
  const target = offer.target;
  const paletteIds: CosmeticId[] = [];
  if (entry.kind === 'item' && target.kind === 'item') {
    const unlockedColors = new Set(
      COSMETIC_INDEX.select({ groupId: entry.groupId }).flatMap((color) =>
        color.kind === 'item-color' && color.requires === entry.id && own(state, color.id) ? [color.colorId] : [],
      ),
    );
    paletteIds.push(
      ...COSMETIC_INDEX.select({ groupId: target.groupId }).flatMap((color) =>
        color.kind === 'item-color' && color.requires === target.id && unlockedColors.has(color.colorId)
          ? [color.id]
          : [],
      ),
    );
    const base = initialColor(target);
    if (base) paletteIds.push(base);
  }
  const ids = [...new Set([target.id, ...paletteIds])].filter((id) => !own(state, id));
  const grantId = `upgrade/${requestId}`;
  grantCharacterCosmetics(
    state,
    grantId,
    ids,
    { kind: 'upgrade', from: entry.id, to: target.id, paid: result.paid, recipeVersion, materials: result.materials },
    now,
  );
  const upgraded = state.instances[`${grantId}:${target.id}`];
  const previousColor = source.colorUnlockId && COSMETIC_CATALOG[source.colorUnlockId];
  const nextColor =
    previousColor?.kind === 'item-color'
      ? paletteIds.find((id) => {
          const color = COSMETIC_CATALOG[id];
          return color.kind === 'item-color' && color.colorId === previousColor.colorId;
        })
      : undefined;
  upgraded.colorUnlockId = (nextColor ?? initialColor(target)) as typeof upgraded.colorUnlockId;
  if (source.location.container === 'warehouse') upgraded.location = { container: 'warehouse' };
  if (source.location.container === 'equipped') {
    upgraded.location = { ...source.location };
    try {
      source.location = { container: 'bag', slot: bagSlot(state) };
    } catch {
      source.location = { container: 'warehouse' };
    }
    const outfit = structuredClone(document.outfit ?? defaultOutfit);
    if (target.kind === 'pet') {
      outfit.pet = target.family ?? target.petId;
      outfit.petLevel = String(target.level ?? 1);
    } else if (target.kind === 'item') {
      const field = outfitFields.find((field) => field.slot === target.slot);
      if (!field) throw new ApiSdkError('NOT_ALLOWED');
      const levelField = outfitFields.find((candidate) => candidate.levelOf === field.key);
      outfit[field.key] = target.family ?? target.itemId;
      if (levelField) outfit[levelField.key] = String(target.level ?? 1);
      const colorField = outfitFields.find((candidate) => candidate.colors === target.slot);
      const palette = upgraded.colorUnlockId && COSMETIC_CATALOG[upgraded.colorUnlockId];
      if (colorField && palette?.kind === 'item-color') outfit[colorField.key] = palette.colorValue;
    }
    document.outfit = outfit;
  }
  return result;
}
