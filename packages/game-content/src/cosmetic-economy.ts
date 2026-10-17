import type { CosmeticShopId } from './cosmetic-shop.js';

/** Definitions for shop/reward integration; importing this module grants nothing. */
export type CosmeticGrantSource =
  | { kind: 'shop'; offerId: string; shop?: CosmeticShopId; paid?: { currency: 'coins' | 'gems'; amount: number } }
  | { kind: 'quest'; questId: string; rewardId: string }
  | { kind: 'event'; eventId: string; rewardId: string }
  | { kind: 'starter'; bundleId: string }
  | { kind: 'migration'; migrationId: string };

export type CosmeticReward = { cosmeticIds: readonly string[] };

/** One listing can bundle an item and its initial palette. No fallback price for unlisted items. */
export type CosmeticShopOffer = {
  id: string;
  shop: CosmeticShopId;
  enabled: boolean;
  price: { currency: 'coins' | 'gems'; amount: number };
  reward: CosmeticReward;
  availableFrom?: number;
  availableUntil?: number;
};

/** Server-issued grant ID must be unique per purchase/reward, not chosen by the client. */
export type CosmeticGrant = {
  id: string;
  characterId: string;
  source: CosmeticGrantSource;
  grantedAt: number;
  reward: CosmeticReward;
};

/** Permanent ownership: changing an owned palette never creates another charge or consumes a grant. */
export type CosmeticOwnership = {
  characterId: string;
  cosmeticId: string;
  firstGrantId: string;
  acquiredAt: number;
};

/** A physical wearable/Pet instance has exactly one location. Palette rights are not physical items. */
export type CharacterItemLocation =
  | { container: 'bag'; slot: number }
  | { container: 'equipped'; slot: string }
  | { container: 'warehouse' };

/** Definition ID identifies the kind of item; instance ID identifies the actual object being moved. */
export type CharacterCosmeticInstance = {
  instanceId: string;
  characterId: string;
  cosmeticId: `item/${string}` | `pet/${string}`;
  /** Item palette stays with the instance when it moves; server validates its item-specific ownership. */
  colorUnlockId?: `item-color/${string}/${string}`;
  firstGrantId: string;
  acquiredAt: number;
  location: CharacterItemLocation;
};

/** Container limits are configuration, not the number of items in the global catalogue. */
export type CharacterInventoryPolicy = {
  bagSlots: number;
  warehouseSlots: number | null;
};
