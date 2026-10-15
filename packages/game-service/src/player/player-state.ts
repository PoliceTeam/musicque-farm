import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError, type Snapshot } from '@chibi-town/contracts';
import type { PlayerDocument } from '../player-document.js';

export const playerSnapshot = (
  document: PlayerDocument,
  now: number,
  farm = document.farm,
  mapInstanceId = 'home',
): Snapshot => ({
  mapInstanceId,
  revision: document.revision,
  serverTime: now,
  farm: structuredClone(farm),
  outfit: structuredClone(document.outfit ?? defaultOutfit),
});

export function playerInstance(document: PlayerDocument, id: string) {
  if (id === 'home') return document.farm;
  const state = document.instances?.[id];
  if (!state) throw new ApiSdkError('MAP_NOT_FOUND');
  state.coins = document.farm.coins;
  state.gems = document.farm.gems;
  state.seeds = document.farm.seeds;
  state.inventory = document.farm.inventory;
  state.chests = document.farm.chests;
  state.homeInventory = document.farm.homeInventory;
  return state;
}
