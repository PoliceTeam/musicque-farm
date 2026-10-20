import { JEWELER_MATERIALS, type JewelerMaterialId } from '@chibi-town/game-content/jeweler';
import { ApiSdkError } from './index.js';

export type JewelerCommand = {
  requestId: string;
  type: 'buy' | 'sell' | 'fuse';
  materialId: JewelerMaterialId;
  count: number;
};
export type JewelerSnapshot = {
  revision: number;
  coins: number;
  availableCoins: number;
  gems: number;
  materials: Record<JewelerMaterialId, number>;
};

export function validateJewelerCommand(input: JewelerCommand) {
  if (
    !input ||
    typeof input.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(input.requestId) ||
    !['buy', 'sell', 'fuse'].includes(input.type) ||
    !JEWELER_MATERIALS.some((m) => m.id === input.materialId) ||
    !Number.isSafeInteger(input.count) ||
    input.count < 1 ||
    input.count > 1000
  )
    throw new ApiSdkError('INVALID_COMMAND');
}

export function decodeJewelerSnapshot(value: unknown): JewelerSnapshot {
  const data = value as JewelerSnapshot;

  const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;

  if (
    !data ||
    !safe(data.revision) ||
    !safe(data.coins) ||
    !safe(data.availableCoins) ||
    data.availableCoins > data.coins ||
    !safe(data.gems) ||
    !data.materials ||
    !JEWELER_MATERIALS.every((m) => safe(data.materials[m.id]))
  )
    throw new ApiSdkError('NETWORK_ERROR');
  return data;
}
