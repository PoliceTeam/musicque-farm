import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import {
  type FriendAction,
  type FriendState,
  type PublicProfile,
  SocialError,
  type SocialPlayer,
} from '@chibi-town/contracts/social';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { friendships, playerDocuments, players } from '@/infrastructure/database/schema';

type Connection = Pick<Database, 'select' | 'insert' | 'update'>;
type Relation = typeof friendships.$inferSelect;

const involved = (id: string) => or(eq(friendships.lowId, id), eq(friendships.highId, id));

const pair = (a: string, b: string) => {
  const [low, high] = [a, b].sort();
  return and(eq(friendships.lowId, low), eq(friendships.highId, high));
};

export function friendState(row: Relation | undefined, self: string): FriendState {
  if (!row || row.status === 'closed') return 'none';
  return row.status === 'accepted' ? 'friends' : row.requestedBy === self ? 'outgoing' : 'incoming';
}

export async function relationship(db: Connection, self: string, target: string) {
  const [row] = await db.select().from(friendships).where(pair(self, target));
  return friendState(row, self);
}

export async function publicPlayer(db: Connection, id: string): Promise<Omit<PublicProfile, 'relationship'>> {
  const [row] = await db
    .select({
      id: players.id,
      name: players.name,
      level: players.level,
      experience: players.experience,
      fashion: players.fashion,
      friendliness: players.friendliness,
      happiness: players.happiness,
      mischief: players.mischief,
      health: players.health,
      document: playerDocuments.document,
    })
    .from(players)
    .innerJoin(playerDocuments, eq(players.id, playerDocuments.playerId))
    .where(eq(players.id, id));
  if (!row) throw new ApiSdkError('NOT_ALLOWED');
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    outfit: sanitizeOutfit(row.document.outfit ?? defaultOutfit),
    stats: {
      experience: row.experience,
      fashion: row.fashion,
      friendliness: row.friendliness,
      happiness: row.happiness,
      mischief: row.mischief,
      health: row.health,
    },
  };
}

export async function friendList(db: Database, self: string) {
  const relations = await db
    .select()
    .from(friendships)
    .where(and(involved(self), inArray(friendships.status, ['pending', 'accepted'])))
    .orderBy(asc(friendships.updatedAt));
  if (!relations.length) return { entries: [] };
  const ids = relations.map((row) => (row.lowId === self ? row.highId : row.lowId));
  const rows = await db
    .select({ id: players.id, name: players.name, level: players.level, document: playerDocuments.document })
    .from(players)
    .innerJoin(playerDocuments, eq(players.id, playerDocuments.playerId))
    .where(inArray(players.id, ids));
  const profiles = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        level: row.level,
        outfit: sanitizeOutfit(row.document.outfit ?? defaultOutfit),
      } satisfies SocialPlayer,
    ]),
  );
  return {
    entries: relations.map((row) => ({
      player: profiles.get(row.lowId === self ? row.highId : row.lowId)!,
      state: friendState(row, self) as Exclude<FriendState, 'none'>,
      updatedAt: row.updatedAt.getTime(),
    })),
  };
}

export async function changeFriendship(db: Database, self: string, target: string, action: FriendAction, now: number) {
  return db.transaction(async (tx) => {
    // All operations affecting either account serialize in the same UUID order, including quotas.
    const accounts = await tx
      .select({ id: players.id })
      .from(players)
      .where(inArray(players.id, [self, target]))
      .orderBy(asc(players.id))
      .for('update');
    if (accounts.length !== 2) throw new ApiSdkError('NOT_ALLOWED');
    const [row] = await tx.select().from(friendships).where(pair(self, target));
    const state = friendState(row, self);
    const timestamp = new Date(now);
    if (action === 'request') {
      if (state !== 'none') return state;
      if (row && now - row.updatedAt.getTime() < 60_000)
        throw new SocialError('FRIEND_REQUEST_COOLDOWN', Math.ceil((60_000 - (now - row.updatedAt.getTime())) / 1000));
      for (const account of [self, target]) {
        const existing = await tx
          .select({ status: friendships.status })
          .from(friendships)
          .where(and(involved(account), inArray(friendships.status, ['pending', 'accepted'])));
        if (existing.filter((r) => r.status === 'pending').length >= 50)
          throw new SocialError(account === self ? 'FRIEND_REQUESTS_FULL' : 'TARGET_FRIEND_REQUESTS_FULL');
        if (existing.filter((r) => r.status === 'accepted').length >= 200)
          throw new SocialError(account === self ? 'FRIEND_LIST_FULL' : 'TARGET_FRIEND_LIST_FULL');
      }
      if (row)
        await tx
          .update(friendships)
          .set({ status: 'pending', requestedBy: self, createdAt: timestamp, updatedAt: timestamp })
          .where(pair(self, target));
      else {
        const [lowId, highId] = [self, target].sort();
        await tx
          .insert(friendships)
          .values({ lowId, highId, requestedBy: self, status: 'pending', createdAt: timestamp, updatedAt: timestamp });
      }
      return 'outgoing' as const;
    }
    if (action === 'accept' && state === 'friends') return state;
    if ((action === 'decline' || action === 'cancel' || action === 'remove') && state === 'none') return state;
    if (
      !row ||
      (action === 'accept' || action === 'decline'
        ? state !== 'incoming'
        : action === 'cancel'
          ? state !== 'outgoing'
          : state !== 'friends')
    )
      throw new ApiSdkError('NOT_ALLOWED');
    if (action === 'accept') {
      for (const account of [self, target]) {
        const accepted = await tx
          .select({ id: friendships.lowId })
          .from(friendships)
          .where(and(involved(account), eq(friendships.status, 'accepted')));
        if (accepted.length >= 200)
          throw new SocialError(account === self ? 'FRIEND_LIST_FULL' : 'TARGET_FRIEND_LIST_FULL');
      }
    }
    await tx
      .update(friendships)
      .set({ status: action === 'accept' ? 'accepted' : 'closed', updatedAt: timestamp })
      .where(pair(self, target));
    return action === 'accept' ? ('friends' as const) : ('none' as const);
  });
}
