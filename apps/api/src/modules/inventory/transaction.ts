import type { PlayerDocument } from '@chibi-town/game-service';
import type { Database } from '@/infrastructure/database/database';
import { loadCharacterInventory, saveCharacterInventory } from '@/modules/inventory/repository';
import { type PlayerTransaction, type TransactionTrace, withPlayerTransaction } from '@/modules/player';

/** Caller holds the player row lock. Collection state is transient; it lives in normalized tables. */
export async function onCharacterInventory<T>(
  tx: PlayerTransaction,
  playerId: string,
  document: PlayerDocument,
  now: number,
  operation: (document: PlayerDocument) => T,
  trace?: TransactionTrace,
) {
  trace?.('load-inventory');
  const before = await loadCharacterInventory(tx, playerId, document, now);
  try {
    trace?.('run-operation');
    const result = await operation(document);
    trace?.('save-inventory');
    if (document.characterInventory) await saveCharacterInventory(tx, playerId, document.characterInventory, before);
    return result;
  } finally {
    delete document.characterInventory;
  }
}

export function withCharacterInventory<T>(
  db: Database,
  playerId: string,
  now: number,
  operation: (document: PlayerDocument) => T,
  trace?: TransactionTrace,
) {
  return withPlayerTransaction(
    db,
    playerId,
    (document, tx) => onCharacterInventory(tx, playerId, document, now, operation, trace),
    trace,
  );
}
