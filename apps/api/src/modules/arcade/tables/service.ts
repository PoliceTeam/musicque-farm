import { randomUUID } from 'node:crypto';
import { ApiSdkError } from '@chibi-town/contracts';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import {
  assertTableAccount,
  configureTable,
  leaveTable,
  type PlayerDocument,
  playAtTable,
  sitAtTable,
  type TableGame,
  type TableOutcome,
  type TableRecord,
  type TableWallets,
  tableGames,
  updateTableMember,
  viewTable,
} from '@chibi-town/game-service';
import type { RealtimePublisher } from '@chibi-town/realtime-core';
import { and, eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { arcadeSeats, arcadeTables } from '@/infrastructure/database/schema';
import { randomSeed } from '@/modules/arcade/random-seed';
import { createTableMaintenance } from '@/modules/arcade/tables/maintenance';
import { createTableRepository } from '@/modules/arcade/tables/repository';

/** A player who does not act for this long forfeits; a waiting or finished table left alone this long is closed. */
export { IDLE_LIMIT_MS, TURN_LIMIT_MS } from '@/modules/arcade/tables/policy';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const uniqueViolation = (error: unknown) =>
  [error, (error as { cause?: unknown })?.cause].some((entry) => (entry as { code?: string })?.code === '23505');

export const lobbyTopic = (gameId: string, channel: number) => `lobby:${gameId}:${channel}`;

export function createTableService(deps: {
  db: Database;
  clock: () => number;
  realtime: RealtimePublisher;
  logger: Pick<FastifyBaseLogger, 'error'>;
}) {
  const { db, clock, realtime } = deps;
  const { lockWallets, refreshNames, store, seatedTable } = createTableRepository(clock);

  const adapter = (gameId: string): TableGame => tableGames[gameId as ArcadeGameId] ?? fail('INVALID_COMMAND');

  function fail(code: ConstructorParameters<typeof ApiSdkError>[0]): never {
    throw new ApiSdkError(code);
  }

  function announce(gameId: ArcadeGameId, channel: number, playerIds: string[]) {
    void Promise.all([
      realtime.notifyPlayers(playerIds, { type: 'match', gameId }),
      realtime.publish(lobbyTopic(gameId, channel), { type: 'lobby', gameId }),
    ]).catch((error) => deps.logger.error(error));
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
    ...createTableMaintenance({ db, clock, adapter, change, logger: deps.logger }),

    has: (gameId: string) => gameId in tableGames,

    /** The match id of the table this player sits at, if any. */
    async seatedMatchId(playerId: string, gameId: string, connection: Database | Transaction = db) {
      const [row] = await connection
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
            occupants: row.record.seats.filter((seat) => !row.record.departedPlayerIds?.includes(seat.playerId)).length,
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
          const [row] = await tx.select().from(arcadeTables).where(address).for('update');
          if (row) await refreshNames(tx, row.record);
          const locked = await lockWallets(tx, [player.id]);
          const [mine] = await tx
            .select({ tableId: arcadeSeats.tableId })
            .from(arcadeSeats)
            .where(and(eq(arcadeSeats.playerId, player.id), eq(arcadeSeats.gameId, gameId)));
          if (mine && mine.tableId !== row?.id) return fail('MATCH_IN_PROGRESS');
          const practice = game.practiceMatch(locked.wallets.get(player.id) as PlayerDocument);
          if (
            (practice && practice.status !== 'finished') ||
            (!mine && locked.wallets.get(player.id)?.tableStakes?.[gameId])
          )
            return fail('MATCH_IN_PROGRESS');
          const ids = {
            now: clock(),
            matchId: randomUUID(),
            seed: randomSeed(),
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
        playAtTable(adapter(gameId), record, playerId, command, wallets, clock(), randomSeed()),
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
      change(playerId, gameId, matchId, (record, wallets) =>
        leaveTable(adapter(gameId), record, playerId, wallets, clock()),
      ),
  };
  return service;
}

export type TableService = ReturnType<typeof createTableService>;

export type TableChange = <T>(
  playerId: string,
  gameId: ArcadeGameId,
  matchId: string | undefined,
  rule: (record: TableRecord, wallets: TableWallets) => TableOutcome<T>,
  transaction?: Transaction,
  announcements?: (() => void)[],
) => Promise<T>;
