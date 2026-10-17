import { ApiSdkError } from '@chibi-town/contracts';
import type { CharacterStats } from '@chibi-town/contracts/character-stats';
import { eq } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { players } from '@/infrastructure/database/schema';

/** Account columns own these points; never copy them into the farm document or client outfit. */
export async function readCharacterStats(db: Database, playerId: string): Promise<CharacterStats> {
  const [stats] = await db
    .select({
      experience: players.experience,
      fashion: players.fashion,
      friendliness: players.friendliness,
      happiness: players.happiness,
      mischief: players.mischief,
      health: players.health,
    })
    .from(players)
    .where(eq(players.id, playerId));
  if (!stats) throw new ApiSdkError('STORAGE_UNAVAILABLE');
  return stats;
}
