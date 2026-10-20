import type { Outfit } from '@chibi-town/character-core/character-types';
import { LUCKY_PRIZES } from '@chibi-town/game-content/lucky-draw';
import { ApiSdkError } from './index.js';

export type LuckyDrawCommand = { requestId: string } & (
  | { type: 'buy-tickets'; count: number }
  | { type: 'spin'; drawId: string }
);
export type LuckyDrawResult = {
  requestId: string;
  prizeId: string;
  spunAt: number;
  duplicate: boolean;
};
export type LuckyDrawSnapshot = {
  revision: number;
  coins: number;
  availableCoins: number;
  gems: number;
  tickets: number;
  outfit: Outfit;
  ownedCosmetics: string[];
  history: LuckyDrawResult[];
  result?: LuckyDrawResult;
};

export function validateLuckyDrawCommand(input: LuckyDrawCommand) {
  if (
    !input ||
    typeof input.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(input.requestId) ||
    (input.type !== 'spin' && input.type !== 'buy-tickets') ||
    (input.type === 'buy-tickets' && (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 100)) ||
    (input.type === 'spin' && (typeof input.drawId !== 'string' || input.drawId.length > 80))
  )
    throw new ApiSdkError('INVALID_COMMAND');
}

export function decodeLuckyDrawSnapshot(value: unknown): LuckyDrawSnapshot {
  const data = value as LuckyDrawSnapshot;

  const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;

  const result = (r: LuckyDrawResult) =>
    r &&
    typeof r.requestId === 'string' &&
    safe(r.spunAt) &&
    typeof r.duplicate === 'boolean' &&
    LUCKY_PRIZES.some((p) => p.id === r.prizeId);

  if (
    !data ||
    !safe(data.revision) ||
    !safe(data.coins) ||
    !safe(data.availableCoins) ||
    data.availableCoins > data.coins ||
    !safe(data.gems) ||
    !safe(data.tickets) ||
    !data.outfit ||
    !Array.isArray(data.ownedCosmetics) ||
    data.ownedCosmetics.some((id) => typeof id !== 'string') ||
    !Array.isArray(data.history) ||
    data.history.length > 10 ||
    !data.history.every(result) ||
    (data.result !== undefined && !result(data.result))
  )
    throw new ApiSdkError('NETWORK_ERROR');
  return data;
}
