import {
  COSMETIC_CATALOG,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { COSMETIC_INDEX } from '@chibi-town/character-core/cosmetic-index';
import { defaultOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CosmeticUpgradeOffer } from '@chibi-town/contracts/character-inventory';
import { PREMIUM_COSMETIC_GROUPS } from '@chibi-town/game-content/cosmetic-shop';
import {
  COSMETIC_UPGRADE_COSTS,
  PET_UPGRADE_MULTIPLIER,
  PREMIUM_UPGRADE_MULTIPLIER,
} from '@chibi-town/game-content/cosmetic-upgrades';
import { LUCKY_EXCLUSIVE_ITEMS } from '@chibi-town/game-content/lucky-draw';
import { initialColor } from '../character/outfit-bindings.js';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import { ensureCharacterInventory, grantCharacterCosmetics } from './cosmetic-grants.js';
import { bagSlot, type CharacterInventoryState, definition, own } from './inventory-state.js';

/** Catalog group membership determines the next level; IDs and prices are never supplied by the client. */
export function cosmeticUpgradeOffer(
  state: CharacterInventoryState,
  entry: Readonly<CosmeticDefinition>,
): CosmeticUpgradeOffer | undefined {
  if ((entry.kind !== 'item' && entry.kind !== 'pet') || !entry.family || !entry.level) return undefined;
  const levels = COSMETIC_INDEX.select({ groupId: entry.groupId })
    .filter((candidate) => candidate.kind === entry.kind && 'level' in candidate && candidate.level)
    .sort((a, b) => ('level' in a ? a.level! : 0) - ('level' in b ? b.level! : 0));
  if (levels.length < 2) return undefined;
  const target = levels.find((candidate) => 'level' in candidate && candidate.level! > entry.level!);
  const cost = target && 'level' in target ? COSMETIC_UPGRADE_COSTS[target.level!] : undefined;
  // Reward-only targets cannot become purchasable through an upgrade route.
  if (target && (!cost || LUCKY_EXCLUSIVE_ITEMS.some((id) => id === target.id))) return undefined;
  const multiplier =
    entry.kind === 'pet'
      ? PET_UPGRADE_MULTIPLIER
      : PREMIUM_COSMETIC_GROUPS.some((group) => group === entry.groupId)
        ? PREMIUM_UPGRADE_MULTIPLIER
        : 1;
  return {
    target: target ?? null,
    price: { currency: 'coins', amount: (cost ?? 0) * multiplier },
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
) {
  const state = ensureCharacterInventory(document, now);
  const source = Object.hasOwn(state.instances, instanceId) ? state.instances[instanceId] : undefined;
  if (!source || !own(state, source.cosmeticId)) throw new ApiSdkError('NOT_ALLOWED', undefined, 'INSTANCE_NOT_OWNED');
  const entry = definition(source.cosmeticId);
  const offer = cosmeticUpgradeOffer(state, entry);
  if (!offer?.target || offer.target.id !== targetId || offer.owned)
    throw new ApiSdkError('NOT_ALLOWED', undefined, 'UPGRADE_UNAVAILABLE');
  if (document.farm.coins - reservedArcadeCoins(document) < offer.price.amount)
    throw new ApiSdkError('INSUFFICIENT_COINS');
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
    { kind: 'upgrade', from: entry.id, to: target.id, paid: { currency: 'coins', amount: offer.price.amount } },
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
  document.farm.coins -= offer.price.amount;
}
