import {
  isTienSnapshot,
  type TienAction,
  type TienResult,
  type TienSnapshot,
} from '@chibi-town/arcade-games/tien-len-logic';
import { validArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { type ArcadeRoom, validArcadeRequestId, validArcadeRooms } from './arcade.js';
import { type ArcadeTableStart, validArcadeStartOptions } from './arcade-table.js';
export type TienLobby = {
  source: 'local' | 'live';
  availableCoins?: number;
  rooms: readonly ArcadeRoom[];
  activeMatch?: TienSnapshot;
  wins: number;
};
export type TienCommand = { requestId: string; matchId: string; revision: number; action: TienAction };

export function validTienStart(v: ArcadeTableStart) {
  return !!v && validArcadeRequestId(v.requestId) && validArcadeSeat(v.roomId, v.tableId) && validArcadeStartOptions(v);
}

export function validTienCommand(v: TienCommand) {
  return (
    !!v &&
    validArcadeRequestId(v.requestId) &&
    typeof v.matchId === 'string' &&
    v.matchId.length > 0 &&
    v.matchId.length <= 100 &&
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    !!v.action &&
    (['start', 'pass'].includes(v.action.type) ||
      (v.action.type === 'play' &&
        Array.isArray(v.action.cards) &&
        v.action.cards.length > 0 &&
        v.action.cards.length <= 13 &&
        v.action.cards.every((c) => Number.isSafeInteger(c) && c >= 0 && c < 52) &&
        new Set(v.action.cards).size === v.action.cards.length))
  );
}

export function decodeTienSnapshot(v: unknown): TienSnapshot {
  if (!isTienSnapshot(v)) throw new Error('Invalid card table');
  return v;
}

export function decodeTienResult(v: unknown): TienResult {
  const r = v as TienResult;
  if (
    !r ||
    !isTienSnapshot(r.match) ||
    !Array.isArray(r.steps) ||
    r.steps.length > 201 ||
    r.steps.some(
      (s) =>
        !s ||
        !Number.isSafeInteger(s.actor) ||
        s.actor < 0 ||
        s.actor > 3 ||
        !['start', 'play', 'pass'].includes(s.action) ||
        !Array.isArray(s.cards) ||
        s.cards.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 51) ||
        !isTienSnapshot(s.match) ||
        s.match.id !== r.match.id,
    )
  )
    throw new Error('Invalid card result');
  return r;
}

export function decodeTienLobby(v: unknown): TienLobby {
  const l = v as TienLobby;
  if (
    !l ||
    !['local', 'live'].includes(l.source) ||
    !Number.isSafeInteger(l.wins) ||
    l.wins < 0 ||
    !validArcadeRooms(l.rooms, 4) ||
    (l.activeMatch !== undefined && !isTienSnapshot(l.activeMatch))
  )
    throw new Error('Invalid card lobby');
  return l;
}
