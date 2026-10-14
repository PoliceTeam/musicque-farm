import { randomUUID } from 'node:crypto';
import { ApiSdkError } from '@chibi-town/contracts';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import {
  assertTableAccount,
  configureTable,
  leaveTable,
  normalizePlayerDocument,
  type PlayerDocument,
  playAtTable,
  sitAtTable,
  TABLE_TURN_LIMIT_MS,
  type TableGame,
  type TableOutcome,
  type TableRecord,
  type TableWallets,
  tableGames,
  updateTableMember,
  viewTable,
} from '@chibi-town/game-service';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/db/database';
import { arcadeSeats, arcadeTables, playerDocuments, players } from '@/db/schema';
import type { RealtimeHub } from '@/modules/realtime/realtime-hub';

/** A player who does not act for this long forfeits; a waiting or finished table left alone this long is closed. */
export const TURN_LIMIT_MS = TABLE_TURN_LIMIT_MS;
export const IDLE_LIMIT_MS = 10 * 60_000;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const uniqueViolation = (error: unknown) =>
  [error, (error as { cause?: unknown })?.cause].some((entry) => (entry as { code?: string })?.code === '23505');

export const lobbyTopic = (gameId: string, channel: number) => `lobby:${gameId}:${channel}`;

export function createTableService(deps: { db: Database; clock: () => number; hub: RealtimeHub }) {
  const { db, clock, hub } = deps;

  const adapter = (gameId: string): TableGame => tableGames[gameId as ArcadeGameId] ?? fail('INVALID_COMMAND');

  function fail(code: ConstructorParameters<typeof ApiSdkError>[0]): never {
    throw new ApiSdkError(code);
  }

  /** Locks the saves in id order, so two tables sharing a player can never wait on each other. */
  async function lockWallets(tx: Transaction, playerIds: string[]) {
    const ids = [...new Set(playerIds)].sort();
    const rows = await tx
      .select({ playerId: playerDocuments.playerId, document: playerDocuments.document })
      .from(playerDocuments)
      .where(inArray(playerDocuments.playerId, ids))
      .orderBy(playerDocuments.playerId)
      .for('update');
    if (rows.length !== ids.length) fail('STORAGE_UNAVAILABLE');
    const before = new Map(rows.map((row) => [row.playerId, JSON.stringify(row.document)]));
    const wallets = new Map(rows.map((row) => [row.playerId, normalizePlayerDocument(row.document)]));
    return {
      wallets: wallets as TableWallets,

      async save() {
        for (const [playerId, document] of wallets)
          if (JSON.stringify(document) !== before.get(playerId))
            await tx
              .update(playerDocuments)
              .set({ document, updatedAt: new Date(clock()) })
              .where(eq(playerDocuments.playerId, playerId));
      },
    };
  }

  async function refreshNames(connection: Database | Transaction, record: TableRecord) {
    const seats = [...record.seats, ...(record.resultSeats ?? [])];
    if (!seats.length) return;
    const accounts = await connection
      .select({ id: players.id, name: players.name, username: players.username })
      .from(players)
      .where(
        inArray(
          players.id,
          seats.map((seat) => seat.playerId),
        ),
      );
    const byId = new Map(accounts.map((player) => [player.id, player]));
    for (const seat of seats) {
      const player = byId.get(seat.playerId);
      if (player) {
        seat.name = player.name;
        seat.username = player.username;
      }
    }
  }

  async function lockTable(tx: Transaction, tableId: string) {
    const [row] = await tx.select().from(arcadeTables).where(eq(arcadeTables.id, tableId)).for('update');
    if (row) await refreshNames(tx, row.record);
    return row;
  }

  /** Writes the outcome and returns everyone who should hear about it. */
  async function store(
    tx: Transaction,
    row: { id: string; gameId: string },
    /** Seats before the rule ran; the rule changes the stored record in place. */
    before: string[],
    record: TableRecord | null,
  ) {
    if (!record) {
      await tx.delete(arcadeTables).where(eq(arcadeTables.id, row.id));
      return before;
    }
    const after = record.seats.map((seat) => seat.playerId);
    await tx
      .update(arcadeTables)
      .set({ record, updatedAt: new Date(clock()) })
      .where(eq(arcadeTables.id, row.id));
    const gone = before.filter((id) => !after.includes(id));
    if (gone.length)
      await tx.delete(arcadeSeats).where(and(eq(arcadeSeats.gameId, row.gameId), inArray(arcadeSeats.playerId, gone)));
    const joined = after.filter((id) => !before.includes(id));
    if (joined.length)
      await tx
        .insert(arcadeSeats)
        .values(joined.map((playerId) => ({ playerId, gameId: row.gameId, tableId: row.id })));
    return [...new Set([...before, ...after])];
  }

  function announce(gameId: ArcadeGameId, channel: number, playerIds: string[]) {
    hub.publishToPlayers(playerIds, { type: 'match', gameId });
    hub.publish(lobbyTopic(gameId, channel), { type: 'lobby', gameId });
  }

  async function seatedTable(tx: Transaction, playerId: string, gameId: string) {
    const [seat] = await tx
      .select({ tableId: arcadeSeats.tableId })
      .from(arcadeSeats)
      .where(and(eq(arcadeSeats.playerId, playerId), eq(arcadeSeats.gameId, gameId)));
    return seat ? lockTable(tx, seat.tableId) : undefined;
  }

  /** Runs one table rule for a seated player inside a transaction that holds the table and every seat's save. */
  async function change<T>(
    playerId: string,
    gameId: ArcadeGameId,
    matchId: string | undefined,
    rule: (record: TableRecord, wallets: TableWallets) => TableOutcome<T>,
    transaction?: Transaction,
    announcements?: (() => void)[],
  ): Promise<T> {
    const run = async (tx: Transaction) => {
      const row = await seatedTable(tx, playerId, gameId);
      if (!row || (matchId !== undefined && row.record.match.id !== matchId)) return fail('MAP_NOT_FOUND');
      const locked = await lockWallets(tx, [playerId, ...row.record.seats.map((seat) => seat.playerId)]);
      const before = row.record.seats.map((seat) => seat.playerId);
      const outcome = rule(row.record, locked.wallets);
      const audience = await store(tx, row, before, outcome.record);
      await locked.save();
      return { result: outcome.result, audience, channel: row.channel };
    };

    const done = transaction ? await run(transaction) : await db.transaction(run);

    const notify = () => announce(gameId, done.channel, done.audience);

    if (announcements) announcements.push(notify);
    else notify();
    return done.result;
  }

  const service = {
    has: (gameId: string) => gameId in tableGames,

    /** The match id of the table this player sits at, if any. */
    async seatedMatchId(playerId: string, gameId: string) {
      const [row] = await db
        .select({ record: arcadeTables.record })
        .from(arcadeSeats)
        .innerJoin(arcadeTables, eq(arcadeTables.id, arcadeSeats.tableId))
        .where(and(eq(arcadeSeats.playerId, playerId), eq(arcadeSeats.gameId, gameId)));
      return row?.record.match.id;
    },

    async view(playerId: string, gameId: ArcadeGameId) {
      const [row] = await db
        .select({ record: arcadeTables.record })
        .from(arcadeSeats)
        .innerJoin(arcadeTables, eq(arcadeTables.id, arcadeSeats.tableId))
        .where(and(eq(arcadeSeats.playerId, playerId), eq(arcadeSeats.gameId, gameId)));
      if (row) await refreshNames(db, row.record);
      return row ? viewTable(adapter(gameId), row.record, playerId, clock()) : undefined;
    },

    /** Occupancy of every open table of a game in one channel, keyed `room:table`. */
    async directory(gameId: ArcadeGameId, channel: number) {
      const rows = await db
        .select({ roomId: arcadeTables.roomId, tableId: arcadeTables.tableId, record: arcadeTables.record })
        .from(arcadeTables)
        .where(and(eq(arcadeTables.gameId, gameId), eq(arcadeTables.channel, channel)));
      return new Map(
        rows.map((row) => [
          `${row.roomId}:${row.tableId}`,
          {
            occupants: row.record.seats.length,
            status: row.record.match.status === 'waiting' ? ('waiting' as const) : ('playing' as const),
          },
        ]),
      );
    },

    async sit(
      player: PlayerAccount,
      gameId: ArcadeGameId,
      channel: number,
      input: { roomId: number; tableId?: number; requestId: string },
    ) {
      const game = adapter(gameId);
      assertTableAccount(player.guest, gameId, input.roomId);
      const address = and(
        eq(arcadeTables.gameId, gameId),
        eq(arcadeTables.channel, channel),
        eq(arcadeTables.roomId, input.roomId),
        eq(arcadeTables.tableId, input.tableId ?? 0),
      );

      const attempt = () =>
        db.transaction(async (tx) => {
          const [mine] = await tx
            .select({ tableId: arcadeSeats.tableId })
            .from(arcadeSeats)
            .where(and(eq(arcadeSeats.playerId, player.id), eq(arcadeSeats.gameId, gameId)));
          const [row] = await tx.select().from(arcadeTables).where(address).for('update');
          if (row) await refreshNames(tx, row.record);
          if (mine && mine.tableId !== row?.id) return fail('MATCH_IN_PROGRESS');
          const locked = await lockWallets(tx, [player.id]);
          const practice = game.practiceMatch(locked.wallets.get(player.id) as PlayerDocument);
          if (practice && practice.status !== 'finished') return fail('MATCH_IN_PROGRESS');
          const ids = {
            now: clock(),
            matchId: randomUUID(),
            seed: (clock() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0,
          };
          const before = row?.record.seats.map((seat) => seat.playerId) ?? [];
          const outcome = sitAtTable(
            game,
            row?.record,
            {
              playerId: player.id,
              name: player.name,
              username: player.username,
              guest: player.guest,
              outfit: locked.wallets.get(player.id)!.outfit,
            },
            input,
            ids,
          );
          if (!outcome.record) return fail('STORAGE_UNAVAILABLE');
          if (!row) {
            await tx.insert(arcadeTables).values({
              id: ids.matchId,
              gameId,
              channel,
              roomId: input.roomId,
              tableId: input.tableId ?? 0,
              record: outcome.record,
              updatedAt: new Date(clock()),
            });
            await tx.insert(arcadeSeats).values({ playerId: player.id, gameId, tableId: ids.matchId });
            return { result: outcome.result, audience: [player.id], changed: true };
          }
          const audience = outcome.changed ? await store(tx, row, before, outcome.record) : [];
          return { result: outcome.result, audience, changed: outcome.changed };
        });

      // Two players opening the same empty table collide on the address index; the loser simply joins.
      const done = await attempt().catch((error) => (uniqueViolation(error) ? attempt() : Promise.reject(error)));
      if (done.changed) announce(gameId, channel, done.audience);
      return done.result;
    },

    play: (
      playerId: string,
      gameId: ArcadeGameId,
      command: { requestId: string; revision: number; matchId?: string },
    ) =>
      change(playerId, gameId, command.matchId, (record, wallets) =>
        playAtTable(adapter(gameId), record, playerId, command, wallets, clock()),
      ),

    configure: (playerId: string, gameId: ArcadeGameId, input: { matchId: string; requestId: string; stake: number }) =>
      change(playerId, gameId, input.matchId, (record, wallets) => configureTable(record, playerId, input, wallets)),

    member: (
      playerId: string,
      gameId: ArcadeGameId,
      input: { matchId: string } & Parameters<typeof updateTableMember>[2],
    ) =>
      change(playerId, gameId, input.matchId, (record, wallets) => updateTableMember(record, playerId, input, wallets)),

    leave: (playerId: string, gameId: ArcadeGameId, matchId?: string) =>
      change(playerId, gameId, matchId, (record, wallets) => leaveTable(adapter(gameId), record, playerId, wallets)),

    /** Gives up the player's seats at tables that have not started; a match in play is left to the turn timer. */
    async releaseWaiting(playerId: string) {
      const seats = await db
        .select({ gameId: arcadeSeats.gameId, record: arcadeTables.record })
        .from(arcadeSeats)
        .innerJoin(arcadeTables, eq(arcadeTables.id, arcadeSeats.tableId))
        .where(eq(arcadeSeats.playerId, playerId));
      for (const seat of seats) {
        if (seat.record.match.status !== 'waiting') continue;
        const gameId = seat.gameId as ArcadeGameId;
        await change<unknown>(playerId, gameId, seat.record.match.id, (record, wallets) =>
          record.match.status === 'waiting'
            ? leaveTable(adapter(gameId), record, playerId, wallets)
            : { record, result: undefined, changed: false },
        ).catch(() => undefined);
      }
    },

    /**
     * Closes tables nobody is using and forfeits the seat that let its turn run out. Runs on a timer; a match
     * therefore never waits forever on a player who closed the tab.
     */
    async sweep() {
      const announcements: (() => void)[] = [];
      const acquired = await db.transaction(async (tx) => {
        const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(76324891) as acquired`);
        if (!(lock as unknown as { rows: { acquired: boolean }[] }).rows[0]?.acquired) return false;
        const now = clock();
        // Claim only stale rows. Concurrent commands either complete before this read or keep their row
        // locked and are skipped; a waiting table cannot start between the idle read and its removal.
        const stale = await tx
          .select()
          .from(arcadeTables)
          .where(sql`
          ((${arcadeTables.record}->'match'->>'status') = 'playing'
            and coalesce((${arcadeTables.record}->>'turnStartedAt')::bigint,
              extract(epoch from ${arcadeTables.updatedAt}) * 1000) <= ${now - TURN_LIMIT_MS})
          or ((${arcadeTables.record}->'match'->>'status') <> 'playing'
            and ${arcadeTables.updatedAt} < ${new Date(now - IDLE_LIMIT_MS).toISOString()}::timestamptz)
        `)
          .for('update', { skipLocked: true });
        // A sweep may touch several tables sharing players. Acquire the union in one global order
        // before processing any payouts, so its accumulated locks cannot invert another command's order.
        if (stale.length)
          await lockWallets(
            tx,
            stale.flatMap((row) => row.record.seats.map((seat) => seat.playerId)),
          );
        for (const row of stale) {
          const gameId = row.gameId as ArcadeGameId;
          const playing = row.record.match.status === 'playing';
          if (playing && now - (row.record.turnStartedAt ?? row.updatedAt.getTime()) < TURN_LIMIT_MS) continue;
          const seat = playing ? adapter(gameId).turn(row.record.match) : 0;
          const leavers = playing
            ? [row.record.seats[seat]?.playerId]
            : row.record.seats.map((entry) => entry.playerId);
          const seen = row.record.match.revision;
          for (const playerId of leavers)
            if (playerId)
              await change<unknown>(
                playerId,
                gameId,
                row.record.match.id,
                (record, wallets) =>
                  // The table moved on while this sweep was reading it; leave it for the next pass.
                  !playing ||
                  (record.match.revision === seen &&
                    now - (record.turnStartedAt ?? row.updatedAt.getTime()) >= TURN_LIMIT_MS)
                    ? leaveTable(adapter(gameId), record, playerId, wallets)
                    : { record, result: undefined, changed: false },
                tx,
                announcements,
              ).catch(() => undefined);
        }
        await tx
          .delete(players)
          .where(and(eq(players.guest, true), lt(players.lastSeenAt, new Date(now - 30 * 86400_000))));
        return true;
      });
      for (const notify of announcements) notify();
      return acquired;
    },
  };
  return service;
}

export type TableService = ReturnType<typeof createTableService>;
