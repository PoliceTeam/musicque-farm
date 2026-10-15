import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { leaveTable, type TableGame } from '@chibi-town/game-service';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Database } from '@/infrastructure/database/database';
import { arcadeSeats, arcadeTables, players } from '@/infrastructure/database/schema';
import { IDLE_LIMIT_MS, TURN_LIMIT_MS } from '@/modules/arcade/tables/policy';
import type { TableChange } from '@/modules/arcade/tables/service';

export function createTableMaintenance(deps: {
  db: Database;
  clock: () => number;
  adapter: (gameId: string) => TableGame;
  change: TableChange;
  logger: Pick<FastifyBaseLogger, 'error'>;
}) {
  const { db, clock, adapter, change, logger } = deps;
  return {
    /** Releases waiting seats; each change commits independently. */
    async releaseWaiting(playerId: string) {
      const seats = await db
        .select({ tableId: arcadeTables.id, gameId: arcadeSeats.gameId, record: arcadeTables.record })
        .from(arcadeSeats)
        .innerJoin(arcadeTables, eq(arcadeTables.id, arcadeSeats.tableId))
        .where(eq(arcadeSeats.playerId, playerId));
      for (const seat of seats) {
        if (seat.record.match.status !== 'waiting') continue;
        const gameId = seat.gameId as ArcadeGameId;
        try {
          await change<unknown>(playerId, gameId, seat.record.match.id, (record, wallets) =>
            record.match.status === 'waiting'
              ? leaveTable(adapter(gameId), record, playerId, wallets, clock())
              : { record, result: undefined, changed: false },
          );
        } catch (err) {
          logger.error({ err, tableId: seat.tableId }, 'Failed to release waiting table');
        }
      }
    },

    /** Select candidates briefly, then lock, recheck and commit each table independently. */
    async sweep() {
      const now = clock();
      const candidates = await db.transaction(async (tx) => {
        const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(76324891) as acquired`);
        if (!(lock as unknown as { rows: { acquired: boolean }[] }).rows[0]?.acquired) return undefined;
        return tx
          .select({ id: arcadeTables.id })
          .from(arcadeTables)
          .where(sql`
          ((${arcadeTables.record}->'match'->>'status') = 'playing'
            and coalesce((${arcadeTables.record}->>'turnStartedAt')::bigint,
              extract(epoch from ${arcadeTables.updatedAt}) * 1000) <= ${now - TURN_LIMIT_MS})
          or ((${arcadeTables.record}->'match'->>'status') <> 'playing'
            and ${arcadeTables.updatedAt} < ${new Date(now - IDLE_LIMIT_MS).toISOString()}::timestamptz)
        `);
      });
      if (!candidates) return false;
      for (const candidate of candidates) {
        const announcements: (() => void)[] = [];
        try {
          await db.transaction(async (tx) => {
            const [row] = await tx
              .select()
              .from(arcadeTables)
              .where(eq(arcadeTables.id, candidate.id))
              .for('update', { skipLocked: true });
            if (!row) return;
            const gameId = row.gameId as ArcadeGameId;
            const playing = row.record.match.status === 'playing';
            if (
              playing
                ? now - (row.record.turnStartedAt ?? row.updatedAt.getTime()) < TURN_LIMIT_MS
                : now - row.updatedAt.getTime() <= IDLE_LIMIT_MS
            )
              return;
            const seat = playing ? adapter(gameId).turn(row.record.match) : 0;
            const leavers = playing
              ? [row.record.seats[seat]?.playerId]
              : row.record.seats
                  .map((entry) => entry.playerId)
                  .filter((id) => !row.record.departedPlayerIds?.includes(id));
            for (const playerId of leavers) {
              if (playerId)
                await change<unknown>(
                  playerId,
                  gameId,
                  row.record.match.id,
                  (record, wallets) => leaveTable(adapter(gameId), record, playerId, wallets, clock()),
                  tx,
                  announcements,
                );
            }
          });
          for (const notify of announcements) notify();
        } catch (err) {
          logger.error({ err, tableId: candidate.id }, 'Failed to sweep table');
        }
      }
      await db
        .delete(players)
        .where(and(eq(players.guest, true), lt(players.lastSeenAt, new Date(now - 30 * 86400_000))));
      return true;
    },
  };
}
