import { ApiSdkError, type SdkErrorCode } from '@chibi-town/contracts';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import { tableGames } from './table-adapters.js';
import type { TableGame, TableMatch, TableRecord, TableWallets } from './table-types.js';

export const isFinished = (game: TableGame, match: TableMatch) => game.finished?.(match) ?? match.status === 'finished';

export const ENGINE_ERRORS: SdkErrorCode[] = [
  'INVALID_TURN',
  'INVALID_PLAY',
  'INVALID_MOVE',
  'CANNOT_PASS',
  'MATCH_FINISHED',
  'NO_MATCH',
  'NOT_ENOUGH_MANA',
];

export const fail = (code: SdkErrorCode): never => {
  throw new ApiSdkError(code);
};

export const available = (document: PlayerDocument) => document.farm.coins - reservedArcadeCoins(document);

export const wallet = (wallets: TableWallets, playerId: string) => wallets.get(playerId) ?? fail('STORAGE_UNAVAILABLE');

export const seatOf = (record: TableRecord, playerId: string) => {
  const seat = record.seats.findIndex((entry) => entry.playerId === playerId);
  return seat < 0 ? fail('NOT_ALLOWED') : seat;
};

export function receipt<T>(
  record: TableRecord,
  playerId: string,
  requestId: string,
  payload: unknown,
  run: () => T,
): T {
  const fingerprint = JSON.stringify(payload);
  const mine = record.receipts[playerId] ?? {};
  const prior = Object.hasOwn(mine, requestId) ? mine[requestId] : undefined;
  if (prior) return prior.fingerprint === fingerprint ? (prior.result as T) : fail('REQUEST_CONFLICT');
  const result = run();
  // Re-read: `run` may have replaced the receipts when the table restarted.
  const next = record.receipts[playerId] ?? {};
  record.receipts[playerId] = next;
  next[requestId] = { fingerprint, result };
  for (const key of Object.keys(next).slice(0, -20)) delete next[key];
  return result;
}

/** Members mirror the seats; the session keeps the fields the table UI already reads. */
export function syncSession(record: TableRecord, ready: (playerId: string) => boolean) {
  const session = record.match.session!;
  session.hostId = record.seats[0].playerId;
  const previous = session.members;
  session.members = record.seats.map((seat) => ({
    ...previous?.find((m) => m.id === seat.playerId),
    id: seat.playerId,
    ready: ready(seat.playerId),
  }));
  if (session.playerCount !== undefined)
    session.playerCount = Math.min(4, Math.max(2, record.seats.length)) as 2 | 3 | 4;
}

export const houseTable = (record: TableRecord) => tableGames[record.gameId]?.settlement === 'house';

export const memberStake = (record: TableRecord, seat: number) =>
  houseTable(record) ? (record.match.session!.members?.[seat]?.stake ?? 0) : record.match.session!.stake;

export const readiness = (record: TableRecord) => {
  const members = record.match.session?.members ?? [];
  return (playerId: string) => members.find((member) => member.id === playerId)?.ready ?? false;
};
