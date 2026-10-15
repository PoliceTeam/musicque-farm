import { ApiSdkError } from '@chibi-town/contracts';
import type { CosmeticShopOffer } from '@chibi-town/game-content/cosmetic-economy';
import { COSMETIC_SHOP_PRICES } from '@chibi-town/game-content/cosmetic-shop';
import { initialColor } from '../character/outfit-bindings.js';
import { ensureCharacterInventory, grantCharacterCosmetics } from '../inventory/cosmetic-grants.js';
import { definition, own } from '../inventory/inventory-state.js';
import type { PlayerDocument } from '../player-document.js';

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

export function buyCosmetic(document: PlayerDocument, offerId: string, requestId: string, now: number) {
  const state = ensureCharacterInventory(document, now);
  const offer = cosmeticOffer(offerId);
  const ids = offer.reward.cosmeticIds.filter((id) => !own(state, id));
  if (own(state, offerId)) throw new ApiSdkError('NOT_ALLOWED', undefined, 'COSMETIC_ALREADY_OWNED');
  if (document.farm.coins < offer.price.amount) throw new ApiSdkError('INSUFFICIENT_COINS');
  grantCharacterCosmetics(state, `shop/${requestId}`, ids, { kind: 'shop', offerId: offer.id }, now);
  document.farm.coins -= offer.price.amount;
}
