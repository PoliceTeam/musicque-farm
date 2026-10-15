import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import { players, sessions } from '@/infrastructure/database/schema';

export type PlayerAccount = { id: string; name: string; level: number; guest: boolean; username: string | null };

export const SESSION_COOKIE = 'chibi_session';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const GUEST_SESSION_SECONDS = 365 * 24 * 60 * 60;

/** Only the hash is stored, so a database leak does not expose usable cookies. */
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Database, playerId: string, now: number, seconds = SESSION_SECONDS) {
  const token = randomBytes(32).toString('base64url');
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
  await db
    .insert(sessions)
    .values({ tokenHash: hashSessionToken(token), playerId, expiresAt: new Date(now + seconds * 1000) });
  return token;
}

export type SessionState = { player: PlayerAccount; expiresAt: number };

/** Read-only authentication for realtime handshake and periodic revocation checks. */
export async function readSessionState(
  db: Database,
  token: string | undefined,
  now: number,
): Promise<SessionState | undefined> {
  if (!token || token.length > 200) return undefined;
  const [session] = await db
    .select({
      player: {
        id: players.id,
        name: players.name,
        level: players.level,
        guest: players.guest,
        username: players.username,
      },
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(players, eq(players.id, sessions.playerId))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date(now))));
  return session && { player: session.player, expiresAt: session.expiresAt.getTime() };
}

/** HTTP activity refreshes lastSeenAt; socket heartbeats use the read-only lookup above. */
export async function readSession(
  db: Database,
  token: string | undefined,
  now: number,
): Promise<PlayerAccount | undefined> {
  const account = (await readSessionState(db, token, now))?.player;
  if (account)
    await db
      .update(players)
      .set({ lastSeenAt: new Date(now) })
      .where(and(eq(players.id, account.id), lt(players.lastSeenAt, new Date(now - 3600_000))));
  return account;
}

export async function deleteSession(db: Database, token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}
