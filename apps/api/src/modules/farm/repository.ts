import { ApiSdkError } from '@chibi-town/contracts';
import type { SocialPlayer } from '@chibi-town/contracts/social';
import { normalizePlayerDocument, type PlayerDocument } from '@chibi-town/game-service';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { playerDocuments, players } from '@/infrastructure/database/schema';
import { publicPlayer, relationship } from '@/modules/social';

/** Same account lock order as friendship edits; both farms commit in one transaction. */
export function withFriendFarms<T>(
  db: Database,
  visitorId: string,
  ownerId: string,
  now: number,
  operation: (
    visitor: SocialPlayer,
    visitorDocument: PlayerDocument,
    owner: SocialPlayer,
    ownerDocument: PlayerDocument,
  ) => T,
) {
  return db.transaction(async (tx) => {
    const ids = [visitorId, ownerId].sort();
    const accounts = await tx
      .select({ id: players.id })
      .from(players)
      .where(inArray(players.id, ids))
      .orderBy(asc(players.id))
      .for('update');
    if (accounts.length !== 2 || (await relationship(tx, visitorId, ownerId)) !== 'friends')
      throw new ApiSdkError('NOT_ALLOWED');
    const rows = await tx
      .select()
      .from(playerDocuments)
      .where(inArray(playerDocuments.playerId, ids))
      .orderBy(asc(playerDocuments.playerId))
      .for('update');
    if (rows.length !== 2 || rows.some((row) => row.document.version !== 1))
      throw new ApiSdkError('STORAGE_UNAVAILABLE');
    const before = new Map(rows.map((row) => [row.playerId, JSON.stringify(row.document)]));
    const documents = new Map(rows.map((row) => [row.playerId, normalizePlayerDocument(row.document)]));

    const toPublic = async (id: string): Promise<SocialPlayer> => {
      const { name, level, outfit } = await publicPlayer(tx, id);
      return { id, name, level, outfit };
    };

    const result = operation(
      await toPublic(visitorId),
      documents.get(visitorId)!,
      await toPublic(ownerId),
      documents.get(ownerId)!,
    );
    for (const row of rows) {
      const document = documents.get(row.playerId)!;
      if (JSON.stringify(document) === before.get(row.playerId)) continue;
      await tx
        .update(playerDocuments)
        .set({ document, updatedAt: new Date(now) })
        .where(eq(playerDocuments.playerId, row.playerId));
    }
    return result;
  });
}
