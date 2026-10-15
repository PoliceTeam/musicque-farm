import { ApiSdkError } from '@chibi-town/contracts';
import { normalizePlayerDocument, type PlayerDocument } from '@chibi-town/game-service';
import { eq } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { playerDocuments } from '@/infrastructure/database/schema';

export type PlayerTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type TransactionTrace = (phase: string) => void;

/** Lock before reading; wallet, command receipts and feature writes commit or roll back together. */
export function withPlayerTransaction<T>(
  db: Database,
  playerId: string,
  operation: (document: PlayerDocument, tx: PlayerTransaction) => T,
  trace: TransactionTrace | undefined,
  clock: () => number,
) {
  return db.transaction(async (tx) => {
    trace?.('lock-player');
    const [row] = await tx
      .select({ document: playerDocuments.document })
      .from(playerDocuments)
      .where(eq(playerDocuments.playerId, playerId))
      .for('update');
    if (row?.document.version !== 1) throw new ApiSdkError('STORAGE_UNAVAILABLE');
    const before = JSON.stringify(row.document);
    const document = normalizePlayerDocument(row.document);
    trace?.('load-player');
    const value = await operation(document, tx);
    trace?.('save-player');
    if (JSON.stringify(document) !== before)
      await tx
        .update(playerDocuments)
        .set({ document, updatedAt: new Date(clock()) })
        .where(eq(playerDocuments.playerId, playerId));
    return value;
  });
}

export function withPlayerDocument<T>(
  db: Database,
  playerId: string,
  operation: (document: PlayerDocument) => T,
  trace: TransactionTrace | undefined,
  clock: () => number,
) {
  return withPlayerTransaction(
    db,
    playerId,
    (document) => {
      trace?.('run-operation');
      return operation(document);
    },
    trace,
    clock,
  );
}
