import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { leaveTable, type TableGame } from '@chibi-town/game-service';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { arcadeSeats, arcadeTables, players } from '@/infrastructure/database/schema';
import { IDLE_LIMIT_MS, TURN_LIMIT_MS } from '@/modules/arcade/tables/policy';
import type { createTableRepository } from '@/modules/arcade/tables/repository';
import type { TableChange } from '@/modules/arcade/tables/service';

export function createTableMaintenance(deps: {
  db: Database;
  clock: () => number;
  adapter: (gameId: string) => TableGame;
  change: TableChange;
  lockWallets: ReturnType<typeof createTableRepository>['lockWallets'];
}) {
  const { db, clock, adapter, change, lockWallets } = deps;
  return {
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
}
