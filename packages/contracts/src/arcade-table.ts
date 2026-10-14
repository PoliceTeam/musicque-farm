import type { MiniGameId } from '@chibi-town/arcade-games/mini-games-logic';
import { type ArcadeDifficulty, type ArcadeSession, validArcadeSession } from '@chibi-town/arcade-games/session';
import { validArcadeRequestId } from './arcade-request.js';
export type ArcadeTableStart = {
  roomId: number;
  tableId?: number;
  requestId: string;
  prepare?: boolean;
  difficulty?: ArcadeDifficulty;
};
export type ArcadeTableCommand = {
  gameId: 'diamonds' | 'tien-len' | 'phom' | MiniGameId;
  matchId: string;
  revision: number;
  requestId: string;
};
export type ArcadeTableSettings = ArcadeTableCommand & {
  stake: number;
  difficulty: ArcadeDifficulty;
  playerCount?: 2 | 3 | 4;
  choice?: number;
  bets?: { memberId: string; stake: number; choice?: number }[];
};
export type ArcadeTableResult = { coins: number; coinDelta: number; session?: ArcadeSession };

export function validArcadeTableCommand(v: ArcadeTableCommand) {
  return (
    !!v &&
    ['diamonds', 'tien-len', 'phom', 'bau-cua', 'slots', 'chess', 'chinese-chess'].includes(v.gameId) &&
    typeof v.matchId === 'string' &&
    v.matchId.length > 0 &&
    v.matchId.length <= 100 &&
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    validArcadeRequestId(v.requestId)
  );
}

export function validArcadeSettings(v: ArcadeTableSettings) {
  return (
    validArcadeTableCommand(v) &&
    Number.isSafeInteger(v.stake) &&
    v.stake >= 0 &&
    ['easy', 'medium', 'hard'].includes(v.difficulty) &&
    (v.bets === undefined ||
      (['bau-cua', 'slots'].includes(v.gameId) &&
        Array.isArray(v.bets) &&
        v.bets.length <= 4 &&
        new Set(v.bets.map((b) => b.memberId)).size === v.bets.length &&
        v.bets.every(
          (b) =>
            typeof b.memberId === 'string' &&
            b.memberId.length > 0 &&
            Number.isSafeInteger(b.stake) &&
            b.stake >= 0 &&
            (b.choice === undefined || (Number.isInteger(b.choice) && b.choice >= 0 && b.choice < 6)),
        ))) &&
    (v.choice === undefined ||
      (v.gameId === 'bau-cua' && Number.isInteger(v.choice) && v.choice >= 0 && v.choice < 6)) &&
    (v.playerCount === undefined || (['tien-len', 'phom'].includes(v.gameId) && [2, 3, 4].includes(v.playerCount)))
  );
}

export function validArcadeStartOptions(v: ArcadeTableStart) {
  return (
    (v.prepare === undefined || typeof v.prepare === 'boolean') &&
    (v.difficulty === undefined || ['easy', 'medium', 'hard'].includes(v.difficulty))
  );
}

export function decodeArcadeTableResult(v: unknown): ArcadeTableResult {
  const r = v as ArcadeTableResult;
  if (
    !r ||
    !Number.isSafeInteger(r.coins) ||
    r.coins < 0 ||
    !Number.isSafeInteger(r.coinDelta) ||
    (r.session !== undefined && !validArcadeSession(r.session))
  )
    throw new Error('Invalid table response');
  return r;
}

export type ArcadeMemberCommand = ArcadeTableCommand & {
  action:
    | { type: 'kick'; memberId: string }
    | { type: 'ready'; ready: boolean; memberId?: string }
    | { type: 'invite-bot' };
};

export function validArcadeMemberCommand(v: ArcadeMemberCommand) {
  return (
    validArcadeTableCommand(v) &&
    !!v.action &&
    (v.action.type === 'kick'
      ? typeof v.action.memberId === 'string' && v.action.memberId.length > 0 && v.action.memberId.length <= 100
      : (v.action.type === 'ready' &&
          typeof v.action.ready === 'boolean' &&
          (v.action.memberId === undefined ||
            (typeof v.action.memberId === 'string' &&
              v.action.memberId.length > 0 &&
              v.action.memberId.length <= 100))) ||
        v.action.type === 'invite-bot')
  );
}
