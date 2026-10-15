import {
  COSMETIC_CATALOG,
  type CosmeticDefinition,
  type CosmeticId,
} from '@chibi-town/character-core/cosmetic-catalog';
import { ApiSdkError } from '@chibi-town/contracts';
import type {
  CharacterCosmeticInstance,
  CosmeticGrant,
  CosmeticOwnership,
} from '@chibi-town/game-content/cosmetic-economy';

export type CharacterInventoryState = {
  version: 1;
  characterId: 'main';
  bagSlots: number;
  instances: Record<string, CharacterCosmeticInstance>;
  unlocks: Record<string, CosmeticOwnership>;
  grants: Record<string, CosmeticGrant>;
};

export function definition(id: string): Readonly<CosmeticDefinition> {
  if (!Object.hasOwn(COSMETIC_CATALOG, id)) throw new ApiSdkError('INVALID_COMMAND', undefined, 'UNKNOWN_COSMETIC');
  return COSMETIC_CATALOG[id as CosmeticId];
}

export function own(state: CharacterInventoryState, id: string) {
  return Object.hasOwn(state.unlocks, id);
}

export function bagSlot(state: CharacterInventoryState): number {
  const used = new Set(
    Object.values(state.instances).flatMap((item) => (item.location.container === 'bag' ? [item.location.slot] : [])),
  );
  for (let slot = 0; slot < state.bagSlots; slot++) if (!used.has(slot)) return slot;
  throw new ApiSdkError('INVENTORY_FULL', undefined, 'NO_FREE_BAG_SLOT');
}
