import { defaultOutfit, outfitFields } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterInventoryCommand } from '@chibi-town/contracts/character-inventory';
import { equipOwnedOutfit } from '../character/equip-outfit.js';
import { initialColor } from '../character/outfit-bindings.js';
import type { PlayerDocument } from '../player-document.js';
import { buyCosmetic } from '../shop/cosmetic-offers.js';
import { ensureCharacterInventory } from './cosmetic-grants.js';
import { upgradeCharacterItem } from './cosmetic-upgrades.js';
import { bagSlot, definition, own } from './inventory-state.js';

export function executeCharacterInventory(
  document: PlayerDocument,
  command: CharacterInventoryCommand,
  requestId: string,
  now: number,
) {
  const state = ensureCharacterInventory(document, now);
  if (command.type === 'buy-cosmetic') {
    buyCosmetic(document, command.offerId, requestId, now);
    return;
  }
  if (command.type === 'apply-cosmetic-color') {
    const entry = definition(command.cosmeticId);
    if (!own(state, entry.id)) throw new ApiSdkError('NOT_ALLOWED', undefined, 'COLOR_NOT_OWNED');
    const next = structuredClone(document.outfit ?? defaultOutfit);
    if (entry.kind === 'skin-color') next.skin = entry.colorValue;
    else if (entry.kind === 'item-color') {
      const item = Object.values(state.instances).find(
        (value) => value.cosmeticId === entry.requires && value.location.container === 'equipped',
      );
      const field = outfitFields.find((value) => value.colors === entry.slot);
      if (!item || !field) throw new ApiSdkError('NOT_ALLOWED');
      next[field.key] = entry.colorValue;
    } else throw new ApiSdkError('INVALID_COMMAND');
    equipOwnedOutfit(document, next, now);
    return;
  }
  if (command.type === 'upgrade-character-item') {
    upgradeCharacterItem(document, command.instanceId, command.targetId, requestId, now);
    return;
  }
  if (!Object.hasOwn(state.instances, command.instanceId))
    throw new ApiSdkError('NOT_ALLOWED', undefined, 'INSTANCE_NOT_OWNED');
  const item = state.instances[command.instanceId];
  const entry = definition(item.cosmeticId);
  if (command.type === 'move-character-item') {
    if (item.location.container === 'equipped' || item.location.container === command.to)
      throw new ApiSdkError('NOT_ALLOWED');
    item.location = command.to === 'bag' ? { container: 'bag', slot: bagSlot(state) } : { container: 'warehouse' };
    return;
  }
  const next = structuredClone(document.outfit ?? defaultOutfit);
  if (entry.kind === 'pet') {
    if (command.type === 'unequip-character-item') next.pet = '';
    else {
      next.pet = entry.family ?? entry.petId;
      next.petLevel = String(entry.level ?? 1);
    }
  } else if (entry.kind === 'item') {
    const field = outfitFields.find((value) => value.slot === entry.slot);
    if (!field) throw new ApiSdkError('NOT_ALLOWED');
    if (command.type === 'unequip-character-item') {
      if (!field.optional) throw new ApiSdkError('NOT_ALLOWED');
      next[field.key] = '';
    } else {
      next[field.key] = entry.family ?? entry.itemId;
      const levelField = outfitFields.find((value) => value.levelOf === field.key);
      if (levelField) next[levelField.key] = String(entry.level ?? 1);
      const colorField = outfitFields.find((value) => value.colors === entry.slot);
      if (colorField) {
        const color = item.colorUnlockId ?? initialColor(entry);
        const palette = color && definition(color);
        if (palette?.kind !== 'item-color') throw new ApiSdkError('NOT_ALLOWED');
        next[colorField.key] = palette.colorValue;
      }
    }
  } else throw new ApiSdkError('NOT_ALLOWED');
  if (command.type === 'unequip-character-item' && item.location.container !== 'equipped')
    throw new ApiSdkError('NOT_ALLOWED');
  equipOwnedOutfit(document, next, now);
}
