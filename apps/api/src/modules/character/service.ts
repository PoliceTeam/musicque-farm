import { sanitizeOutfit, starterOutfit, starterOutfitFields } from '@chibi-town/character-core/outfit-logic';
import { grantStarterSelection } from '@chibi-town/game-service';
import { eq } from 'drizzle-orm';
import { playerDocuments } from '@/infrastructure/database/schema';
import { onCharacterInventory } from '@/modules/inventory';
import type { PlayerTransaction as Transaction } from '@/modules/player';

export async function saveStarterOutfit(tx: Transaction, id: string, value: unknown, now = Date.now()) {
  if (value === undefined) return;
  const [row] = await tx.select().from(playerDocuments).where(eq(playerDocuments.playerId, id)).for('update');
  await onCharacterInventory(tx, id, row.document, now, (document) => {
    const selected = starterOutfit(value);
    if (row.document.characterSetupPending === undefined && row.document.outfit) {
      const existing = sanitizeOutfit(row.document.outfit);
      const given = value as Record<string, unknown>;
      const next = { ...existing };
      if (selected.gender !== existing.gender) {
        Object.assign(next, selected);
        // Keep equipment outside the starter editor when changing gender.
        for (const key of ['hat', 'hatLevel', 'back', 'backLevel', 'held', 'tail', 'pet', 'petLevel'] as const)
          next[key] = existing[key];
      } else {
        for (const field of starterOutfitFields)
          if (given[field.key] !== undefined && given[field.key] !== existing[field.key])
            next[field.key] = selected[field.key];
      }
      row.document.outfit = sanitizeOutfit(next);
    } else row.document.outfit = selected;
    grantStarterSelection(document, document.outfit!, now);
  });
  row.document.characterSetupPending = false;
  row.document.revision++;
  await tx
    .update(playerDocuments)
    .set({ document: row.document, updatedAt: new Date(now) })
    .where(eq(playerDocuments.playerId, id));
}
