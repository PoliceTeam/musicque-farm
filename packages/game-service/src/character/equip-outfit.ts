import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { ensureCharacterInventory } from '../inventory/cosmetic-grants.js';
import { bagSlot, own } from '../inventory/inventory-state.js';
import type { PlayerDocument } from '../player-document.js';
import { bindings, skinId } from './outfit-bindings.js';

export function equipOwnedOutfit(document: PlayerDocument, requested: Outfit, now: number) {
  const state = ensureCharacterInventory(document, now);
  const checked = sanitizeOutfit(requested);
  if (Object.keys(defaultOutfit).some((key) => checked[key as keyof Outfit] !== requested[key as keyof Outfit]))
    throw new ApiSdkError('NOT_ALLOWED', undefined, 'INVALID_OUTFIT');
  const worn = bindings(checked);
  if (!own(state, skinId(checked))) throw new ApiSdkError('NOT_ALLOWED', undefined, 'SKIN_NOT_OWNED');
  const chosen = worn.map((binding) => {
    const item = Object.values(state.instances).find((value) => value.cosmeticId === binding.cosmeticId);
    if (!item) throw new ApiSdkError('NOT_ALLOWED', undefined, 'ITEM_NOT_OWNED');
    if (item.location.container === 'warehouse') throw new ApiSdkError('NOT_ALLOWED', undefined, 'ITEM_IN_WAREHOUSE');
    if (binding.colorUnlockId && !own(state, binding.colorUnlockId))
      throw new ApiSdkError('NOT_ALLOWED', undefined, 'COLOR_NOT_OWNED');
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
