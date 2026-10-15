import { ApiSdkError } from '@chibi-town/contracts';
import { normalizePlayerDocument, type PlayerDocument } from '@chibi-town/game-service';
import { eq } from 'drizzle-orm';
import type { Database } from '@/db/database';
import { playerDocuments } from '@/db/schema';
import { loadCharacterInventory, saveCharacterInventory } from '@/modules/game/character-inventory-repository';

/** Runs one operation on a player's save. The row stays locked from read to write, so concurrent commands queue. */
export function withPlayerDocument<T>(
  db: Database,
  playerId: string,
  operation: (document: PlayerDocument) => T,
  character = false,
  now = Date.now(),
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ document: playerDocuments.document })
      .from(playerDocuments)
      .where(eq(playerDocuments.playerId, playerId))
      .for('update');
    if (row?.document.version !== 1) throw new ApiSdkError('STORAGE_UNAVAILABLE');
    const before = JSON.stringify(row.document);
    const document = normalizePlayerDocument(row.document);
    const characterBefore = character ? await loadCharacterInventory(tx, playerId, document, now) : undefined;
    const value = await operation(document);
    if (character && document.characterInventory)
      await saveCharacterInventory(tx, playerId, document.characterInventory, characterBefore);
    delete document.characterInventory;
    if (JSON.stringify(document) !== before)
      await tx
        .update(playerDocuments)
        .set({ document, updatedAt: new Date() })
        .where(eq(playerDocuments.playerId, playerId));
    return value;
  });
}
