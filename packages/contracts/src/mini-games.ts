import {
  isMiniGameId,
  isMiniSnapshot,
  type MiniAction,
  type MiniGameId,
  type MiniResult,
  type MiniSnapshot,
} from '@chibi-town/arcade-games/mini-games-logic';
import { validArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { type ArcadeRoom, validArcadeRequestId, validArcadeRooms } from './arcade.js';
import { type ArcadeTableStart, validArcadeStartOptions } from './arcade-table.js';
export type MiniLobby = {
  gameId: MiniGameId;
  source: 'local' | 'live';
  rooms: readonly ArcadeRoom[];
  availableCoins: number;
  activeMatch?: MiniSnapshot;
  wins: number;
};
export type MiniStart = ArcadeTableStart & { gameId: MiniGameId };
export type MiniCommand = {
  gameId: MiniGameId;
  matchId: string;
  revision: number;
  requestId: string;
  action: MiniAction;
};

export function validMiniStart(v: MiniStart) {
  return (
    !!v &&
    isMiniGameId(v.gameId) &&
    validArcadeRequestId(v.requestId) &&
    validArcadeSeat(v.roomId, v.tableId) &&
    validArcadeStartOptions(v)
  );
}

export function validMiniCommand(v: MiniCommand) {
  const a = v?.action;
  return (
    !!v &&
    isMiniGameId(v.gameId) &&
    validArcadeRequestId(v.requestId) &&
    typeof v.matchId === 'string' &&
    v.matchId.length > 0 &&
    v.matchId.length <= 100 &&
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    !!a &&
    (['start', 'spin', 'resign', 'next-round'].includes(a.type) ||
      (a.type === 'roll' && Number.isInteger(a.symbol) && a.symbol >= 0 && a.symbol < 6) ||
      (a.type === 'move' &&
        Number.isInteger(a.from) &&
        Number.isInteger(a.to) &&
        a.from >= 0 &&
        a.to >= 0 &&
        a.from < (v.gameId === 'chess' ? 64 : 90) &&
        a.to < (v.gameId === 'chess' ? 64 : 90) &&
        (a.promotion === undefined || ['q', 'r', 'b', 'n'].includes(a.promotion))))
  );
}

export function decodeMiniSnapshot(v: unknown) {
  if (!isMiniSnapshot(v)) throw new Error('Invalid mini game');
  return v;
}

export function decodeMiniResult(v: unknown): MiniResult {
  const r = v as MiniResult;
  decodeMiniSnapshot(r?.match);
  if (
    !Array.isArray(r.steps) ||
    r.steps.length > 3 ||
    r.steps.some((s) => !isMiniSnapshot(s) || s.gameId !== r.match.gameId || s.id !== r.match.id)
  )
    throw new Error('Invalid mini result');
  return r;
}

export function decodeMiniLobby(v: unknown): MiniLobby {
  const l = v as MiniLobby;
  if (
    !l ||
    !isMiniGameId(l.gameId) ||
    !['local', 'live'].includes(l.source) ||
    !validArcadeRooms(l.rooms, l.gameId === 'bau-cua' || l.gameId === 'slots' ? 4 : 2) ||
    !Number.isSafeInteger(l.availableCoins) ||
    l.availableCoins < 0 ||
    !Number.isSafeInteger(l.wins) ||
    l.wins < 0 ||
    (l.activeMatch !== undefined && (!isMiniSnapshot(l.activeMatch) || l.activeMatch.gameId !== l.gameId))
  )
    throw new Error('Invalid mini lobby');
  return l;
}
