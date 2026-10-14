import {
  isPhomSnapshot,
  type PhomAction,
  type PhomResult,
  type PhomSnapshot,
} from '@chibi-town/arcade-games/phom-logic';
import { type ArcadeRoom, validArcadeRequestId, validArcadeRooms } from './arcade.js';
export type PhomLobby = {
  source: 'local' | 'live';
  availableCoins?: number;
  rooms: readonly ArcadeRoom[];
  activeMatch?: PhomSnapshot;
  wins: number;
};
export type PhomCommand = { requestId: string; matchId: string; revision: number; action: PhomAction };

export function validPhomCommand(v: PhomCommand) {
  const a = v?.action;
  return (
    !!v &&
    validArcadeRequestId(v.requestId) &&
    typeof v.matchId === 'string' &&
    v.matchId.length > 0 &&
    v.matchId.length <= 100 &&
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    !!a &&
    (['start', 'draw', 'eat', 'lay', 'done'].includes(a.type) ||
      ((a.type === 'discard' || a.type === 'send') &&
        Number.isInteger(a.card) &&
        a.card >= 0 &&
        a.card < 52 &&
        (a.type !== 'send' ||
          (Number.isInteger(a.seat) &&
            a.seat >= 0 &&
            a.seat < 4 &&
            Number.isInteger(a.meld) &&
            a.meld >= 0 &&
            a.meld < 4))))
  );
}

export function decodePhomSnapshot(v: unknown): PhomSnapshot {
  if (!isPhomSnapshot(v)) throw new Error('Invalid Phom table');
  return v;
}

export function decodePhomResult(v: unknown): PhomResult {
  const r = v as PhomResult;
  decodePhomSnapshot(r?.match);
  if (
    !Array.isArray(r.steps) ||
    r.steps.length > 82 ||
    r.steps.some(
      (s) =>
        !s ||
        !Number.isInteger(s.actor) ||
        s.actor < 0 ||
        s.actor > 3 ||
        !['start', 'draw', 'eat', 'lay', 'done', 'discard', 'send'].includes(s.action) ||
        !isPhomSnapshot(s.match) ||
        s.match.id !== r.match.id,
    )
  )
    throw new Error('Invalid Phom result');
  return r;
}

export function decodePhomLobby(v: unknown): PhomLobby {
  const l = v as PhomLobby;
  if (
    !l ||
    !['local', 'live'].includes(l.source) ||
    !Number.isSafeInteger(l.wins) ||
    l.wins < 0 ||
    !validArcadeRooms(l.rooms, 4) ||
    (l.activeMatch !== undefined && !isPhomSnapshot(l.activeMatch))
  )
    throw new Error('Invalid Phom lobby');
  return l;
}
