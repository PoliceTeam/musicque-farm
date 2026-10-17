import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterCosmeticInstance, CosmeticGrantSource } from '@chibi-town/game-content/cosmetic-economy';
import { CHARACTER_BAG_SLOTS } from '@chibi-town/game-content/cosmetic-shop';
import { bindings, initialColor, skinId } from '../character/outfit-bindings.js';
import type { PlayerDocument } from '../player-document.js';
import { bagSlot, type CharacterInventoryState, definition, own } from './inventory-state.js';

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

/** Migrate trusted outfits once and repair missing base palettes on historical shop purchases. */
export function ensureCharacterInventory(document: PlayerDocument, now: number): CharacterInventoryState {
  if (document.characterInventory) {
    const state = document.characterInventory;
    // Previously bought items retain every palette and also receive their canonical base color.
    for (const instance of Object.values(state.instances)) {
      if (state.grants[instance.firstGrantId]?.source.kind !== 'shop') continue;
      const color = initialColor(definition(instance.cosmeticId));
      if (color && !own(state, color))
        grantCharacterCosmetics(
          state,
          `migration/base-color/${instance.cosmeticId}`,
          [color],
          { kind: 'migration', migrationId: 'base-colors/v1' },
          now,
        );
    }
    return state;
  }
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
