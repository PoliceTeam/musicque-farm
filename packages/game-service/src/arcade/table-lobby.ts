import type { RandomSeed } from '@chibi-town/arcade-games/random';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import type { ArcadeTableResult } from '@chibi-town/contracts/arcade-table';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import {
  available,
  fail,
  houseTable,
  isFinished,
  memberStake,
  readiness,
  receipt,
  seatOf,
  syncSession,
  wallet,
} from './table-state.js';
import type { TableGame, TableOutcome, TableRecord, TableSeat, TableWallets } from './table-types.js';
import { named } from './table-view.js';

/** Guests can practice or wager against the house, but cannot transfer coins at peer tables. */
export function assertTableAccount(guest: boolean, gameId: ArcadeGameId, roomId: number) {
  if (guest && roomId !== 3 && gameId !== 'bau-cua' && gameId !== 'slots') fail('ACCOUNT_REQUIRED');
}

/** Sits at an address: opens the table, joins a waiting one, returns to one's own, or restarts a finished one. */
export function sitAtTable(
  game: TableGame,
  record: TableRecord | undefined,
  player: TableSeat,
  input: { roomId: number; tableId?: number; requestId: string },
  ids: { matchId: string; seed: RandomSeed; now?: number },
): TableOutcome<unknown> {
  assertTableAccount(player.guest ?? false, game.gameId, input.roomId);
  player = { ...player, outfit: sanitizeOutfit(player.outfit) };
  const tableId = input.tableId ?? 0;
  if (!record) {
    const match = game.create(ids.matchId, input.roomId, tableId, ids.seed);
    match.session = {
      hostId: player.playerId,
      mode: 'wager',
      stake: 0,
      difficulty: 'medium',
      configured: false,
      members: [{ id: player.playerId, ready: false }],
      ...(game.settlement === 'house' ? { settlement: 'house' as const } : {}),
      ...(game.capacity === 4 && game.settlement !== 'house'
        ? { payoutRule: 'ranked-pool' as const, playerCount: 2 as const }
        : {}),
    };
    const created: TableRecord = { gameId: game.gameId, match, seats: [player], receipts: {} };
    return { record: created, result: named(created, 0, game.snapshot(match, 0), ids.now), changed: true };
  }
  if (isFinished(game, record.match) && record.departedPlayerIds?.length) {
    record.seats = record.seats.filter((seat) => !record.departedPlayerIds!.includes(seat.playerId));
    delete record.departedPlayerIds;
  }
  const seated = record.seats.findIndex((entry) => entry.playerId === player.playerId);
  if (seated >= 0) record.seats[seated] = { ...player, outfit: sanitizeOutfit(player.outfit) };
  if (isFinished(game, record.match) && seated >= 0) {
    // Same people, same stake: a fresh deal that everyone has to confirm again.
    const previous = record.match.session!;
    const match = game.create(record.match.id, record.match.roomId, record.match.tableId ?? 0, ids.seed);
    match.revision = record.match.revision + 1;
    match.session = {
      hostId: previous.hostId,
      mode: 'wager',
      stake: previous.stake,
      difficulty: previous.difficulty,
      configured: previous.configured,
      ...(game.settlement === 'house'
        ? { settlement: 'house' as const, members: previous.members?.map((m) => ({ ...m, ready: false })) }
        : {}),
      ...(previous.payoutRule ? { payoutRule: previous.payoutRule, playerCount: previous.playerCount } : {}),
    };
    record.match = match;
    delete record.resultSeats;
    delete record.lastSteps;
    delete record.turnStartedAt;
    record.receipts = {};
    syncSession(
      record,
      (playerId) => game.settlement !== 'house' && playerId === previous.hostId && !!previous.configured,
    );
    return { record, result: named(record, seated, game.snapshot(match, seated), ids.now), changed: true };
  }
  if (seated >= 0)
    return { record, result: named(record, seated, game.snapshot(record.match, seated), ids.now), changed: true };
  if (record.match.status !== 'waiting') return fail('MATCH_IN_PROGRESS');
  if (record.seats.length >= game.capacity) return fail('NOT_ALLOWED');
  const ready = readiness(record);
  record.seats.push(player);
  syncSession(record, ready);
  record.match.revision++;
  const seat = record.seats.length - 1;
  return { record, result: named(record, seat, game.snapshot(record.match, seat), ids.now), changed: true };
}

/** Host sets the stake. Everyone else has to confirm again, because the amount they agreed to has changed. */
export function configureTable(
  record: TableRecord,
  playerId: string,
  input: { requestId: string; stake: number; choice?: number; bets?: unknown[] },
  wallets: TableWallets,
): TableOutcome<ArcadeTableResult> {
  const document = wallet(wallets, playerId);
  const result = receipt(record, playerId, input.requestId, { type: 'configure', ...input }, () => {
    const session = record.match.session!;
    if (record.match.status !== 'waiting') return fail('MATCH_IN_PROGRESS');
    const house = houseTable(record);
    seatOf(record, playerId);
    if (!house && session.hostId !== playerId) return fail('NOT_ALLOWED');
    if (house && input.bets?.length) return fail('NOT_ALLOWED');
    if (
      !Number.isSafeInteger(input.stake) ||
      input.stake < 1 ||
      input.stake > available(document) ||
      input.stake > Math.floor(Number.MAX_SAFE_INTEGER / 8)
    )
      return fail('INSUFFICIENT_COINS');
    if (house) {
      const ready = readiness(record);
      const mine = session.members!.find((m) => m.id === playerId)!;
      mine.stake = input.stake;
      if (record.gameId === 'bau-cua') mine.choice = input.choice ?? mine.choice ?? 0;
      if (session.hostId === playerId) {
        session.stake = input.stake;
        session.configured = true;
      }
      syncSession(record, (id) => id === playerId || ready(id));
    } else {
      session.stake = input.stake;
      session.configured = true;
      syncSession(record, (id) => id === playerId);
    }
    record.match.revision++;
    return { coins: document.farm.coins, coinDelta: 0, session: { ...session } };
  });
  return { record, result, changed: true };
}

export function updateTableMember(
  record: TableRecord,
  playerId: string,
  input: {
    requestId: string;
    action: { type: 'ready'; ready: boolean } | { type: 'kick'; memberId: string } | { type: 'invite-bot' };
  },
  wallets: TableWallets,
): TableOutcome<ArcadeTableResult> & { removed?: string } {
  const document = wallet(wallets, playerId);
  let removed: string | undefined;
  const result = receipt(record, playerId, input.requestId, { type: 'member', ...input }, () => {
    const session = record.match.session!;
    const ready = readiness(record);
    seatOf(record, playerId);
    if (record.match.status !== 'waiting') return fail('MATCH_IN_PROGRESS');
    if (input.action.type === 'ready') {
      const next = input.action.ready;
      const stake = memberStake(record, seatOf(record, playerId));
      if (next && ((!houseTable(record) && !session.configured) || stake < 1 || stake > available(document)))
        return fail('INSUFFICIENT_COINS');
      syncSession(record, (id) => (id === playerId ? next : ready(id)));
    } else if (input.action.type === 'kick') {
      const target = input.action.memberId;
      if (session.hostId !== playerId || target === playerId || !record.seats.some((seat) => seat.playerId === target))
        return fail('NOT_ALLOWED');
      record.seats = record.seats.filter((seat) => seat.playerId !== target);
      delete record.receipts[target];
      removed = target;
      syncSession(record, ready);
    } else return fail('NOT_ALLOWED'); // Wager tables are for people; bots stay in the practice room.
    record.match.revision++;
    return { coins: document.farm.coins, coinDelta: 0, session: { ...session } };
  });
  return { record, result, changed: true, removed };
}
