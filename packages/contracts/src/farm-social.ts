import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { FARM_PLOT_LIMIT } from '@chibi-town/game-content/farm-land-config';
import { ApiSdkError, decodeSnapshot, type Snapshot } from './index.js';
import { decodeFriendList, isPlayerId, type SocialPlayer } from './social.js';

export type FarmVisit = { owner: SocialPlayer; snapshot: Snapshot };
export type StealFarmCrop = { ownerId: string; index: number; wateredAt: number; requestId: string };
export type FarmTheftEntry = { visitorId: string; visitorName: string; cropId: CropId; index: number; at: number };

export function validateStealFarmCrop(input: StealFarmCrop) {
  if (
    !input ||
    !isPlayerId(input.ownerId) ||
    !Number.isSafeInteger(input.index) ||
    input.index < 0 ||
    input.index >= FARM_PLOT_LIMIT ||
    !Number.isSafeInteger(input.wateredAt) ||
    input.wateredAt < 0 ||
    typeof input.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(input.requestId)
  )
    throw new ApiSdkError('INVALID_COMMAND');
}

export function decodeFarmVisit(value: unknown): FarmVisit {
  const data = value as FarmVisit;
  if (!data) throw new ApiSdkError('NETWORK_ERROR');
  const owner = decodeFriendList({ entries: [{ player: data.owner, state: 'friends', updatedAt: 0 }] }).entries[0]
    .player;
  return { owner, snapshot: decodeSnapshot(data.snapshot) };
}

export function decodeFarmTheftHistory(value: unknown): FarmTheftEntry[] {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some(
      (entry) =>
        !entry ||
        !isPlayerId(entry.visitorId) ||
        typeof entry.visitorName !== 'string' ||
        entry.visitorName.length > 40 ||
        !Object.hasOwn(FARM_CROPS, entry.cropId) ||
        !Number.isSafeInteger(entry.index) ||
        entry.index < 0 ||
        !Number.isSafeInteger(entry.at) ||
        entry.at < 0,
    )
  )
    throw new ApiSdkError('NETWORK_ERROR');
  return value.map(({ visitorId, visitorName, cropId, index, at }) => ({ visitorId, visitorName, cropId, index, at }));
}
