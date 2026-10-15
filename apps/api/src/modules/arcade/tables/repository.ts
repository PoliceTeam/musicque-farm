import { ApiSdkError } from '@chibi-town/contracts';
import { normalizePlayerDocument, type TableRecord, type TableWallets } from '@chibi-town/game-service';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { arcadeSeats, arcadeTables, playerDocuments, players } from '@/infrastructure/database/schema';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createTableRepository(clock: () => number) {
  const fail = (code: ConstructorParameters<typeof ApiSdkError>[0]): never => {
    throw new ApiSdkError(code);
  };

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

  async function seatedTable(tx: Transaction, playerId: string, gameId: string) {
    const [seat] = await tx
      .select({ tableId: arcadeSeats.tableId })
      .from(arcadeSeats)
      .where(and(eq(arcadeSeats.playerId, playerId), eq(arcadeSeats.gameId, gameId)));
    return seat ? lockTable(tx, seat.tableId) : undefined;
  }

  return { lockWallets, refreshNames, lockTable, store, seatedTable };
}
