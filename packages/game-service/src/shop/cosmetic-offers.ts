import { COSMETIC_CATALOG, type CosmeticDefinition } from '@chibi-town/character-core/cosmetic-catalog';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CosmeticShopOffer } from '@chibi-town/game-content/cosmetic-economy';
import {
  COSMETIC_SHOP_PRICES,
  COSMETIC_SLOT_PRICES,
  type CosmeticShopId,
  PREMIUM_COLOR_PRICE,
  PREMIUM_COSMETIC_GROUPS,
  PREMIUM_SLOT_PRICES,
} from '@chibi-town/game-content/cosmetic-shop';
import { initialColor } from '../character/outfit-bindings.js';
import { ensureCharacterInventory, grantCharacterCosmetics } from '../inventory/cosmetic-grants.js';
import { definition, own } from '../inventory/inventory-state.js';
import type { PlayerDocument } from '../player-document.js';

const minimumLevels = new Map<string, number>();
for (const entry of Object.values(COSMETIC_CATALOG)) {
  if (entry.kind !== 'item' && entry.kind !== 'pet') continue;
  minimumLevels.set(entry.groupId, Math.min(minimumLevels.get(entry.groupId) ?? Infinity, entry.level ?? 1));
}

/** Higher levels remain valid owned/reward items, but can never be bought, including their palettes. */
export function isBaseCosmetic(entry: Readonly<CosmeticDefinition>) {
  return !('level' in entry) || (entry.level ?? 1) === (minimumLevels.get(entry.groupId) ?? 1);
}

export function cosmeticShop(entry: Readonly<CosmeticDefinition>): CosmeticShopId {
  if (PREMIUM_COSMETIC_GROUPS.some((group) => group === entry.groupId)) return 'premium';
  if (entry.category === 'appearance') return 'salon';
  if (entry.kind === 'pet') return 'pets';
  return 'slot' in entry && ['shirt', 'pants', 'shoes'].includes(entry.slot) ? 'fashion' : 'accessories';
}

export function cosmeticOffer(id: string): CosmeticShopOffer {
  const entry = definition(id);
  const color = initialColor(entry);
  const shop = cosmeticShop(entry);
  const slot = 'slot' in entry ? entry.slot : '';
  const amount =
    entry.kind === 'item-color'
      ? shop === 'premium'
        ? PREMIUM_COLOR_PRICE
        : COSMETIC_SHOP_PRICES.color
      : entry.kind === 'skin-color'
        ? COSMETIC_SHOP_PRICES.skin
        : shop === 'premium'
          ? (PREMIUM_SLOT_PRICES[slot] ?? 200_000)
          : (COSMETIC_SLOT_PRICES[slot] ?? COSMETIC_SHOP_PRICES[entry.category]);
  return {
    id: entry.id,
    shop,
    enabled: isBaseCosmetic(entry),
    price: { currency: 'coins', amount },
    reward: { cosmeticIds: [entry.id, ...(color ? [color] : [])] },
  };
}

export function buyCosmetic(document: PlayerDocument, offerId: string, requestId: string, now: number) {
  const state = ensureCharacterInventory(document, now);
  const offer = cosmeticOffer(offerId);
  if (!offer.enabled) throw new ApiSdkError('NOT_ALLOWED', undefined, 'UPGRADE_ONLY');
  const ids = offer.reward.cosmeticIds.filter((id) => !own(state, id));
  if (own(state, offerId)) throw new ApiSdkError('NOT_ALLOWED', undefined, 'COSMETIC_ALREADY_OWNED');
  if (document.farm.coins < offer.price.amount) throw new ApiSdkError('INSUFFICIENT_COINS');
  grantCharacterCosmetics(
    state,
    `shop/${requestId}`,
    ids,
    { kind: 'shop', offerId: offer.id, shop: offer.shop, paid: { ...offer.price } },
    now,
  );
  document.farm.coins -= offer.price.amount;
}
