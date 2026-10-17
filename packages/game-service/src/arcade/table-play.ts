import type { RandomSeed } from '@chibi-town/arcade-games/random';
import { forfeitTienSeat, type TienMatch } from '@chibi-town/arcade-games/tien-len-logic';
import type { SdkErrorCode } from '@chibi-town/contracts';
import type { ArcadeTableResult } from '@chibi-town/contracts/arcade-table';
import {
  available,
  ENGINE_ERRORS,
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
import type { TableGame, TableOutcome, TableRecord, TableWallets } from './table-types.js';
import { named } from './table-view.js';

export function pay(record: TableRecord, game: TableGame, deltas: number[], wallets: TableWallets) {
  const session = record.match.session!;
  if (
    deltas.length < record.seats.length ||
    deltas.some((delta) => !Number.isSafeInteger(delta)) ||
    (game.settlement !== 'house' && deltas.reduce((sum, delta) => sum + delta, 0) !== 0)
  )
    return fail('INVALID_COMMAND');
  const documents = record.seats.map((seat) => wallet(wallets, seat.playerId));
  const balances = documents.map((document, seat) => document.farm.coins + (deltas[seat] ?? 0));
  if (balances.some((coins) => !Number.isSafeInteger(coins) || coins < 0)) return fail('INSUFFICIENT_COINS');
  documents.forEach((document, seat) => {
    document.farm.coins = balances[seat];
    if (document.tableStakes) delete document.tableStakes[record.gameId];
    document.revision++;
  });
  record.resultSeats = record.seats.map((seat) => ({ ...seat }));
  session.settled = true;
  session.coinDeltas = Array.from({ length: 4 }, (_, seat) => deltas[seat] ?? 0);
  if (game.settlement === 'house') {
    session.housePayouts = record.seats.map((seat, index) => ({
      memberId: seat.playerId,
      delta: deltas[index],
      coinsAfter: balances[index],
    }));
    documents.forEach((document, seat) => {
      if (deltas[seat] > 0) game.recordWin(document);
    });
  }
  const winner = game.settlement === 'house' ? undefined : game.winner(record.match);
  if (winner !== undefined && documents[winner]) game.recordWin(documents[winner]);
}

/** A game action by the caller's seat, including the host's `start`. */
export function playAtTable(
  game: TableGame,
  record: TableRecord,
  playerId: string,
  command: { requestId: string; revision: number },
  wallets: TableWallets,
  now = Date.now(),
  seed?: RandomSeed,
): TableOutcome<unknown> {
  if (!game.validCommand(command)) return fail('INVALID_COMMAND');
  const seat = seatOf(record, playerId);
  const result = receipt(record, playerId, command.requestId, command, () => {
    const session = record.match.session!;
    if (record.match.revision !== command.revision) return fail('REQUEST_CONFLICT');
    const action = game.action(command).type;
    if (game.settlement === 'house' && action === 'next-round' && seat !== 0) return fail('NOT_ALLOWED');
    if (
      action === 'start' ||
      (game.settlement === 'house' && record.match.status === 'waiting' && ['roll', 'spin'].includes(action))
    ) {
      if (session.hostId !== playerId || record.match.status !== 'waiting') return fail('NOT_ALLOWED');
      if (
        !session.configured ||
        record.seats.length < game.minPlayers ||
        !session.members?.every((m) => m.id === session.hostId || m.ready)
      )
        return fail('NOT_ALLOWED');
      const documents = record.seats.map((entry) => wallet(wallets, entry.playerId));
      if (
        documents.some(
          (document, index) => memberStake(record, index) < 1 || memberStake(record, index) > available(document),
        )
      )
        return fail('INSUFFICIENT_COINS');
      for (const [index, document] of documents.entries())
        document.tableStakes = { ...document.tableStakes, [record.gameId]: memberStake(record, index) };
    }
    const previousTurn = game.turn(record.match);
    const previousStatus = record.match.status;
    let next: ReturnType<TableGame['play']>;
    try {
      next = game.play(seed === undefined ? record.match : { ...record.match, seed }, seat, command);
    } catch (error) {
      const code = error instanceof Error ? (error.message as SdkErrorCode) : undefined;
      if (code && ENGINE_ERRORS.includes(code)) return fail(code);
      throw error;
    }
    record.match = next.state;
    if (next.state.status === 'playing' && (previousStatus !== 'playing' || previousTurn !== game.turn(next.state)))
      record.turnStartedAt = now;
    if (next.state.status !== 'playing') delete record.turnStartedAt;
    record.lastSteps = {
      revision: next.state.revision,
      seats: record.seats.map((_, viewer) => (next.result(viewer) as { steps?: unknown[] }).steps ?? []),
    };
    if (next.state.status === 'waiting') delete record.resultSeats;
    if (isFinished(game, next.state) && !next.state.session?.settled)
      pay(record, game, game.deltas(next.state, session.stake, record.seats.length), wallets);
    return named(record, seat, next.result(seat), now);
  });
  return { record, result, changed: true };
}

/**
 * Leaving before the deal or after settlement costs nothing. Tiến lên keeps known placements and settles
 * the ranked pool only after the surviving players determine the top two. Other games split a forfeited stake.
 */
export function leaveTable(
  game: TableGame,
  record: TableRecord,
  playerId: string,
  wallets: TableWallets,
  now = Date.now(),
): TableOutcome<ArcadeTableResult> {
  const seat = seatOf(record, playerId);
  const document = wallet(wallets, playerId);
  const session = record.match.session!;
  if (record.match.status === 'playing' && !session.settled) {
    if (record.gameId === 'tien-len') {
      const match = record.match as TienMatch;
      record.departedPlayerIds = [...new Set([...(record.departedPlayerIds ?? []), playerId])];
      if (match.placements?.includes(seat))
        return { record, result: { coins: document.farm.coins, coinDelta: 0 }, changed: true };
      const stake = memberStake(record, seat);
      const next = forfeitTienSeat(match, seat);
      record.match = next;
      delete record.lastSteps;
      if (next.status === 'finished') {
        pay(record, game, game.deltas(next, session.stake, record.seats.length), wallets);
        return { record: null, result: { coins: document.farm.coins, coinDelta: -stake }, changed: true };
      }
      if (next.turn !== match.turn) record.turnStartedAt = now;
      return { record, result: { coins: document.farm.coins, coinDelta: -stake }, changed: true };
    }

    const others = record.seats.length - 1;
    const stake = memberStake(record, seat);
    const share = others ? Math.floor(stake / others) : 0;
    const deltas = record.seats.map((_, index) => (index === seat ? -stake : share));
    // Whatever does not divide evenly goes to the earliest remaining seat, so the total stays zero.
    if (others) deltas[seat === 0 ? 1 : 0] += stake - share * others;
    pay(
      record,
      {
        ...game,

        recordWin: () => {},

        winner: () => undefined,
      },
      deltas,
      wallets,
    );
    return { record: null, result: { coins: document.farm.coins, coinDelta: -stake }, changed: true };
  }
  const ready = readiness(record);
  record.seats = record.seats.filter(
    (entry) => entry.playerId !== playerId && !record.departedPlayerIds?.includes(entry.playerId),
  );
  delete record.receipts[playerId];
  if (!record.seats.length)
    return { record: null, result: { coins: document.farm.coins, coinDelta: 0 }, changed: true };
  // A finished table keeps its result on screen for those who stay; only a waiting one needs a live session.
  if (isFinished(game, record.match) && houseTable(record)) {
    // House bets belong to IDs, not vacated seat indices. Keep the result, then start the next round with only those still here.
    syncSession(record, ready);
    session.coinDeltas = Array.from(
      { length: 4 },
      (_, index) => session.housePayouts?.find((p) => p.memberId === record.seats[index]?.playerId)?.delta ?? 0,
    );
    record.match.revision++;
  }
  if (record.match.status === 'waiting') {
    syncSession(record, (id) =>
      houseTable(record) ? ready(id) : id === record.seats[0].playerId ? !!session.configured : ready(id),
    );
    record.match.revision++;
  }
  return { record, result: { coins: document.farm.coins, coinDelta: 0 }, changed: true };
}
