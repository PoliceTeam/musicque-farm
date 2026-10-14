import {
  createGemBattle,
  type GemAction,
  type GemBattle,
  gemSeatSnapshot,
  playGemSeatAction,
} from '@chibi-town/arcade-games/gem-battle-logic';
import {
  createMiniMatch,
  type MiniAction,
  type MiniGameId,
  type MiniMatch,
  miniMemberCoinDeltas,
  miniSeatSnapshot,
  playMiniSeatAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import {
  createPhomMatch,
  type PhomAction,
  type PhomMatch,
  type PhomResult,
  phomSeatSnapshot,
  playPhomSeatAction,
} from '@chibi-town/arcade-games/phom-logic';
import type { ArcadeSession } from '@chibi-town/arcade-games/session';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import {
  createTienMatch,
  playTienSeatAction,
  type TienAction,
  type TienMatch,
  type TienResult,
  tienSeatSnapshot,
} from '@chibi-town/arcade-games/tien-len-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError, type SdkErrorCode } from '@chibi-town/contracts';
import { validDiamondCommand } from '@chibi-town/contracts/arcade';
import type { ArcadeTableResult } from '@chibi-town/contracts/arcade-table';
import { validMiniCommand } from '@chibi-town/contracts/mini-games';
import { validPhomCommand } from '@chibi-town/contracts/phom';
import { validTienCommand } from '@chibi-town/contracts/tien-len';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { type PlayerDocument, reservedArcadeCoins } from './player-document.js';

export const TABLE_TURN_LIMIT_MS = 60_000;

type TableMatch = {
  id: string;
  roomId: number;
  tableId?: number;
  revision: number;
  status: string;
  session?: ArcadeSession;
};
export type TableSeat = { playerId: string; name: string; username?: string | null; guest?: boolean; outfit?: Outfit };
/** A table of people. Seat order is join order; seat 0 is the host. Stored once on the server, not per player. */
export type TableRecord<M extends TableMatch = TableMatch> = {
  gameId: ArcadeGameId;
  turnStartedAt?: number;
  lastSteps?: { revision: number; seats: unknown[][] };
  match: M;
  seats: TableSeat[];
  /** Original participants remain named and indexed on the result screen after someone leaves. */
  resultSeats?: TableSeat[];
  /** Last answers per player, so a retried request returns what the first attempt returned. */
  receipts: Record<string, Record<string, { fingerprint: string; result: unknown }>>;
};
/** What a game supplies so the shared table rules can run it. */
export type TableGame<M extends TableMatch = TableMatch> = {
  gameId: ArcadeGameId;
  capacity: number;
  finished?(match: M): boolean;
  settlement?: 'house';
  minPlayers: number;
  create(id: string, roomId: number, tableId: number, seed: number): M;
  validCommand(command: unknown): boolean;
  action(command: unknown): { type: string };
  /** Applies one seat's action; throws `Error(code)` for an illegal one. */
  play(match: M, seat: number, command: unknown): { state: M; result: (viewer: number) => unknown };
  snapshot(match: M, viewer: number): unknown;
  /** Coin change per seat. House games settle each bet independently. */
  deltas(match: M, stake: number, players: number): number[];
  winner(match: M): number | undefined;
  /** Seat that has to act while the match is in play. */
  turn(match: M): number;
  recordWin(document: PlayerDocument): void;
  /** The player's own practice match of this game, which also counts as their one match. */
  practiceMatch(document: PlayerDocument): { status: string } | undefined;
};
/** Saves of every seated player plus the caller, locked by the caller for the whole operation. */
export type TableWallets = ReadonlyMap<string, PlayerDocument>;
export type TableOutcome<T> = { record: TableRecord | null; result: T; changed: boolean };

const isFinished = (game: TableGame, match: TableMatch) => game.finished?.(match) ?? match.status === 'finished';

const ENGINE_ERRORS: SdkErrorCode[] = [
  'INVALID_TURN',
  'INVALID_PLAY',
  'INVALID_MOVE',
  'CANNOT_PASS',
  'MATCH_FINISHED',
  'NO_MATCH',
  'NOT_ENOUGH_MANA',
];

const fail = (code: SdkErrorCode): never => {
  throw new ApiSdkError(code);
};

const available = (document: PlayerDocument) => document.farm.coins - reservedArcadeCoins(document);

const wallet = (wallets: TableWallets, playerId: string) => wallets.get(playerId) ?? fail('STORAGE_UNAVAILABLE');

const seatOf = (record: TableRecord, playerId: string) => {
  const seat = record.seats.findIndex((entry) => entry.playerId === playerId);
  return seat < 0 ? fail('NOT_ALLOWED') : seat;
};

function receipt<T>(record: TableRecord, playerId: string, requestId: string, payload: unknown, run: () => T): T {
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
function syncSession(record: TableRecord, ready: (playerId: string) => boolean) {
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

const houseTable = (record: TableRecord) => tableGames[record.gameId]?.settlement === 'house';

const memberStake = (record: TableRecord, seat: number) =>
  houseTable(record) ? (record.match.session!.members?.[seat]?.stake ?? 0) : record.match.session!.stake;

const readiness = (record: TableRecord) => {
  const members = record.match.session?.members ?? [];
  return (playerId: string) => members.find((member) => member.id === playerId)?.ready ?? false;
};

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
  ids: { matchId: string; seed: number; now?: number },
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

function pay(record: TableRecord, game: TableGame, deltas: number[], wallets: TableWallets) {
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
      if (!session.configured || record.seats.length < game.minPlayers || !session.members?.every((m) => m.ready))
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
      next = game.play(record.match, seat, command);
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
 * Leaving before the deal, or after the result, costs nothing. Leaving a match in play forfeits the stake to the
 * players who stayed and closes the table, because a seat cannot be played on by anyone else.
 */
export function leaveTable(
  game: TableGame,
  record: TableRecord,
  playerId: string,
  wallets: TableWallets,
): TableOutcome<ArcadeTableResult> {
  const seat = seatOf(record, playerId);
  const document = wallet(wallets, playerId);
  const session = record.match.session!;
  if (record.match.status === 'playing' && !session.settled) {
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
  record.seats = record.seats.filter((entry) => entry.playerId !== playerId);
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

/** Adds the names around the table, in the viewer's seat order, to a snapshot or to every snapshot of a result. */
function named<T>(record: TableRecord, seat: number, value: T, now = Date.now()): T {
  const participants = record.resultSeats ?? record.seats;
  const viewer = participants.findIndex((entry) => entry.playerId === record.seats[seat].playerId);
  const players = participants.map((_, index) => {
    const entry = participants[(index + viewer) % participants.length];
    return {
      id: entry.playerId,
      name: entry.name,
      username: entry.username ?? null,
      outfit: sanitizeOutfit(entry.outfit),
    };
  });

  const tag = (snapshot: unknown) => ({
    ...(snapshot as object),
    players,
    serverTime: now,
    ...(record.match.status === 'playing' && record.turnStartedAt !== undefined
      ? { turnEndsAt: record.turnStartedAt + TABLE_TURN_LIMIT_MS }
      : {}),
  });

  const result = value as { match?: unknown; battle?: unknown; steps?: unknown[] };
  if (result && typeof result === 'object' && 'battle' in result) return { ...result, battle: tag(result.battle) } as T;
  if (!result || typeof result !== 'object' || !('match' in result)) return tag(value) as T;
  return {
    ...result,
    match: tag(result.match),
    steps: result.steps?.map((step) => {
      const entry = step as { match?: unknown };
      return 'match' in entry ? { ...entry, match: tag(entry.match) } : tag(step);
    }),
  } as T;
}

/** The table as one of its players sees it; undefined for anyone not seated. */
export function viewTable(game: TableGame, record: TableRecord, playerId: string, now = Date.now()) {
  const seat = record.seats.findIndex((entry) => entry.playerId === playerId);
  if (seat < 0) return undefined;
  const viewer =
    record.resultSeats && game.settlement !== 'house'
      ? record.resultSeats.findIndex((entry) => entry.playerId === playerId)
      : seat;
  const snapshot = named(record, seat, game.snapshot(record.match, viewer), now) as object;
  return {
    ...snapshot,
    serverTime: now,
    ...(record.match.status === 'playing' && record.turnStartedAt !== undefined
      ? { turnEndsAt: record.turnStartedAt + TABLE_TURN_LIMIT_MS }
      : {}),
    ...(record.lastSteps
      ? {
          lastSteps: {
            revision: record.lastSteps.revision,
            steps: named(
              record,
              seat,
              {
                match: snapshot,
                steps:
                  record.lastSteps.seats[
                    record.resultSeats?.findIndex((entry) => entry.playerId === playerId) ?? viewer
                  ] ?? [],
              },
              now,
            ).steps,
          },
        }
      : {}),
  };
}

export const tienTable: TableGame<TienMatch> = {
  gameId: 'tien-len',
  capacity: 4,
  minPlayers: 2,

  create: (id, roomId, tableId, seed) => createTienMatch(id, roomId, seed, tableId),

  validCommand: (command) => validTienCommand(command as never),

  action: (command) => (command as { action: TienAction }).action,

  play(match, seat, command) {
    const { state, step } = playTienSeatAction(match, seat, (command as { action: TienAction }).action);
    const players = state.session?.playerCount ?? 4;
    return {
      state,

      result: (viewer): TienResult => {
        const snapshot = tienSeatSnapshot(state, viewer);
        return {
          match: snapshot,
          steps: [{ ...step, actor: (step.actor - viewer + players) % players, match: snapshot }],
        };
      },
    };
  },

  snapshot: tienSeatSnapshot,

  deltas: (match, stake, players) =>
    match.placements && match.placements.length >= 2
      ? topTwoPayout(stake, match.placements[0], match.placements[1], players)
      : [0, 0, 0, 0],

  winner: (match) => match.winner,

  turn: (match) => match.turn,

  practiceMatch: (document) => document.tien?.activeMatch,

  recordWin(document) {
    document.tien ??= { wins: 0, starts: {}, requests: {} };
    document.tien.wins++;
  },
};
export const phomTable: TableGame<PhomMatch> = {
  gameId: 'phom',
  capacity: 4,
  minPlayers: 2,

  create: (id, roomId, tableId, seed) => createPhomMatch(id, roomId, seed, tableId),

  validCommand: (command) => validPhomCommand(command as never),

  action: (command) => (command as { action: PhomAction }).action,

  play(match, seat, command) {
    const { state, step } = playPhomSeatAction(match, seat, (command as { action: PhomAction }).action);
    return {
      state,

      result: (viewer): PhomResult => {
        const snapshot = phomSeatSnapshot(state, viewer);
        return {
          match: snapshot,
          steps: [
            {
              ...step,
              ...(step.action === 'draw' && viewer !== step.actor ? { card: undefined } : {}),
              actor: (step.actor - viewer + (state.session?.playerCount ?? 4)) % (state.session?.playerCount ?? 4),
              match: snapshot,
            },
          ],
        };
      },
    };
  },

  snapshot: phomSeatSnapshot,

  deltas: (match, stake, players) => topTwoPayout(stake, match.placements![0], match.placements![1], players),

  winner: (match) => match.winner,

  turn: (match) => match.turn,

  practiceMatch: (document) => document.phom?.activeMatch,

  recordWin(document) {
    document.phom ??= { wins: 0, starts: {}, requests: {} };
    document.phom.wins++;
  },
};

export function boardTable(gameId: MiniGameId): TableGame<MiniMatch> {
  return {
    gameId,
    capacity: 2,
    minPlayers: 2,

    create: (id, roomId, tableId, seed) => createMiniMatch(gameId, id, roomId, seed, tableId),

    validCommand: (command) => validMiniCommand(command as never) && (command as { gameId: string }).gameId === gameId,

    action: (command) => (command as { action: MiniAction }).action,

    play(match, seat, command) {
      const { state } = playMiniSeatAction(match, seat, (command as { action: MiniAction }).action);
      return {
        state,

        result: (viewer) => {
          const snapshot = miniSeatSnapshot(state, viewer);
          return { match: snapshot, steps: [snapshot] };
        },
      };
    },

    snapshot: miniSeatSnapshot,

    deltas: (match, stake) =>
      match.outcome === 'draw' ? [0, 0] : match.outcome === 'win' ? [stake, -stake] : [-stake, stake],

    winner: (match) => (match.outcome === 'draw' ? undefined : match.outcome === 'win' ? 0 : 1),

    turn: (match) => match.turn,

    practiceMatch: (document) => document.mini?.[gameId]?.activeMatch,

    recordWin(document) {
      document.mini ??= {};
      document.mini[gameId] ??= { wins: 0, starts: {}, requests: {} };
      document.mini[gameId]!.wins++;
    },
  };
}

export const gemTable: TableGame<GemBattle> = {
  gameId: 'diamonds',
  capacity: 2,
  minPlayers: 2,

  finished: (match) => match.status === 'won' || match.status === 'lost',

  create(id, roomId, tableId, seed) {
    return { ...createGemBattle(id, roomId, seed, tableId), status: 'waiting', turn: 0 };
  },

  validCommand: (command) => validDiamondCommand(command as never),

  action: (command) => (command as { action: GemAction }).action,

  play: (match, seat, command) => playGemSeatAction(match, seat, (command as { action: GemAction }).action),

  snapshot: gemSeatSnapshot,

  deltas: (match, stake) => (match.status === 'won' ? [stake, -stake] : [-stake, stake]),

  winner: (match) => (match.status === 'won' ? 0 : 1),

  turn: (match) => match.turn ?? 0,

  practiceMatch: (document) => {
    const m = document.arcade?.activeBattle;
    return m && { status: m.status === 'won' || m.status === 'lost' ? 'finished' : m.status };
  },

  recordWin(document) {
    document.arcade ??= { bestScore: 0, starts: {}, requests: {} };
  },
};

export function houseGameTable(gameId: 'bau-cua' | 'slots'): TableGame<MiniMatch> {
  return {
    ...boardTable(gameId),
    settlement: 'house',
    capacity: 4,
    minPlayers: 1,

    deltas: (match) => miniMemberCoinDeltas(match).map((payout) => payout.delta),

    winner: () => undefined,
  };
}

export const tableGames: Partial<Record<ArcadeGameId, TableGame>> = {
  slots: houseGameTable('slots') as unknown as TableGame,
  'bau-cua': houseGameTable('bau-cua') as unknown as TableGame,
  diamonds: gemTable as unknown as TableGame,
  'tien-len': tienTable as unknown as TableGame,
  phom: phomTable as unknown as TableGame,
  chess: boardTable('chess') as unknown as TableGame,
  'chinese-chess': boardTable('chinese-chess') as unknown as TableGame,
};
