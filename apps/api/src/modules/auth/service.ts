import { randomInt, randomUUID } from 'node:crypto';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import {
  REGISTRATION_BONUS_COINS,
  REGISTRATION_BONUS_GEMS,
  SERVER_STARTING_COINS,
  SERVER_STARTING_GEMS,
} from '@chibi-town/game-content';
import { createPlayerDocument } from '@chibi-town/game-service';
import { and, eq, or } from 'drizzle-orm';
import { HttpError } from '@/_utils/http-errors';
import { hashPassword, verifyPassword } from '@/_utils/password';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { identities, playerDocuments, players } from '@/infrastructure/database/schema';
import { saveStarterOutfit } from '@/modules/character';

export type ExternalProfile = {
  provider: 'google';
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
};
const account = {
  id: players.id,
  name: players.name,
  level: players.level,
  guest: players.guest,
  username: players.username,
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

const readEmail = (value: unknown) => {
  const email = text(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'INVALID_INPUT');
  return email;
};

const readName = (value: unknown) => {
  const name = text(value).trim();
  if (name.length < 2 || name.length > 20) throw new HttpError(400, 'INVALID_INPUT');
  return name;
};

const readUsername = (value: unknown) => {
  const username = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.]{2,19}$/.test(username)) throw new HttpError(400, 'INVALID_INPUT');
  return username;
};

const readPassword = (value: unknown) => {
  const password = text(value);
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'INVALID_INPUT');
  return password;
};

function uniqueError(error: unknown): never {
  const entries = [error, (error as { cause?: unknown })?.cause] as { code?: string; constraint?: string }[];
  const unique = entries.find((entry) => entry?.code === '23505');
  if (unique) throw new HttpError(409, unique.constraint?.includes('username') ? 'USERNAME_TAKEN' : 'EMAIL_TAKEN');
  throw error;
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Called while the account is locked, inside the create/upgrade transaction. */
async function payRegistrationBonus(tx: Transaction, id: string, now: number) {
  const [player] = await tx.select().from(players).where(eq(players.id, id)).for('update');
  if (player.guest || player.registrationBonusAt) return;
  const [row] = await tx.select().from(playerDocuments).where(eq(playerDocuments.playerId, id)).for('update');
  row.document.farm.coins += REGISTRATION_BONUS_COINS;
  row.document.farm.gems += REGISTRATION_BONUS_GEMS;
  row.document.revision++;
  await tx
    .update(playerDocuments)
    .set({ document: row.document, updatedAt: new Date(now) })
    .where(eq(playerDocuments.playerId, id));
  await tx
    .update(players)
    .set({ registrationBonusAt: new Date(now) })
    .where(eq(players.id, id));
}

type NewAccount = {
  name: string;
  email: string | null;
  passwordHash: string | null;
  username?: string | null;
  guest?: boolean;
  usernameRequired?: boolean;
};

async function insertPlayer(tx: Transaction, values: NewAccount, now: number): Promise<PlayerAccount> {
  const id = randomUUID();
  const [player] = await tx
    .insert(players)
    .values({ id, ...values, lastSeenAt: new Date(now) })
    .returning(account);
  const document = createPlayerDocument();
  if (!values.guest) document.characterSetupPending = true;
  document.farm.coins = SERVER_STARTING_COINS;
  document.farm.gems = SERVER_STARTING_GEMS;
  await tx.insert(playerDocuments).values({ playerId: id, document });
  await payRegistrationBonus(tx, id, now);
  return player;
}

async function upgradeGuest(tx: Transaction, id: string, values: NewAccount, now: number) {
  const [player] = await tx
    .update(players)
    .set({ ...values, guest: false })
    .where(and(eq(players.id, id), eq(players.guest, true)))
    .returning(account);
  if (!player) throw new HttpError(409, 'INVALID_INPUT');
  await payRegistrationBonus(tx, id, now);
  return player;
}

export async function registerPlayer(
  db: Database,
  input: unknown,
  current?: PlayerAccount,
  now = Date.now(),
): Promise<PlayerAccount> {
  const body = (input ?? {}) as Record<string, unknown>;
  const values = {
    email: body.email === undefined || body.email === null || body.email === '' ? null : readEmail(body.email),
    name: readName(body.name),
    username: readUsername(body.username),
    passwordHash: await hashPassword(readPassword(body.password)),
  };
  try {
    return await db.transaction(async (tx) => {
      const player = current?.guest
        ? await upgradeGuest(tx, current.id, values, now)
        : await insertPlayer(tx, values, now);
      if (current?.guest && body.outfit === undefined) {
        const [row] = await tx
          .select()
          .from(playerDocuments)
          .where(eq(playerDocuments.playerId, player.id))
          .for('update');
        row.document.characterSetupPending = true;
        row.document.revision++;
        await tx
          .update(playerDocuments)
          .set({ document: row.document, updatedAt: new Date(now) })
          .where(eq(playerDocuments.playerId, player.id));
      }
      await saveStarterOutfit(tx, player.id, body.outfit, now);
      return player;
    });
  } catch (error) {
    return uniqueError(error);
  }
}

/** Old accounts are assigned a username on their first password/provider sign-in. New Google accounts choose it. */
async function legacyUsername(db: Database, id: string): Promise<PlayerAccount> {
  for (let suffix = 0; ; suffix++) {
    try {
      return await db.transaction(async (tx) => {
        const [player] = await tx.select().from(players).where(eq(players.id, id)).for('update');
        if (player.username || player.guest || player.usernameRequired)
          return {
            id: player.id,
            name: player.name,
            level: player.level,
            guest: player.guest,
            username: player.username,
          };
        let base = (player.email?.split('@')[0] ?? 'player')
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9_.]/g, '')
          .replace(/^[_.]+/, '');
        if (base.length < 3) base = `${base}player`;
        const ending = suffix ? String(suffix) : '';
        const username = base.slice(0, 20 - ending.length) + ending;
        const [updated] = await tx.update(players).set({ username }).where(eq(players.id, id)).returning(account);
        return updated;
      });
    } catch (error) {
      try {
        uniqueError(error);
      } catch (failure) {
        if (!(failure instanceof HttpError) || failure.code !== 'USERNAME_TAKEN') throw failure;
      }
    }
  }
}

export async function loginPlayer(db: Database, input: unknown): Promise<PlayerAccount> {
  const body = (input ?? {}) as Record<string, unknown>;
  const identifier = text(body.email).trim().toLowerCase();
  const [player] = await db
    .select({ ...account, passwordHash: players.passwordHash })
    .from(players)
    .where(or(eq(players.email, identifier), eq(players.username, identifier)));
  if (!player || !(await verifyPassword(text(body.password), player.passwordHash)))
    throw new HttpError(401, 'INVALID_CREDENTIALS');
  return legacyUsername(db, player.id);
}

/** Identity, account upgrade and bonus commit together. Unique constraints also protect concurrent callbacks. */
export async function signInWithProvider(
  db: Database,
  profile: ExternalProfile,
  current?: PlayerAccount,
  now = Date.now(),
): Promise<PlayerAccount & { registrationBonusGranted?: boolean }> {
  const email = readEmail(profile.email);
  if (!profile.emailVerified) throw new HttpError(401, 'INVALID_CREDENTIALS');

  const linkedAccount = async () =>
    (
      await db
        .select(account)
        .from(identities)
        .innerJoin(players, eq(players.id, identities.playerId))
        .where(and(eq(identities.provider, profile.provider), eq(identities.subject, profile.subject)))
    )[0];

  const linked = await linkedAccount();
  if (linked) return legacyUsername(db, linked.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select(account).from(players).where(eq(players.email, email)).for('update');
      const name = profile.name.trim().slice(0, 20);
      const values = { name: name.length < 2 ? 'Chibi' : name, email, passwordHash: null, usernameRequired: true };
      const player =
        existing ??
        (current?.guest ? await upgradeGuest(tx, current.id, values, now) : await insertPlayer(tx, values, now));
      await tx.insert(identities).values({ provider: profile.provider, subject: profile.subject, playerId: player.id });
      return { ...player, registrationBonusGranted: !existing };
    });
    return { ...(await legacyUsername(db, result.id)), registrationBonusGranted: result.registrationBonusGranted };
  } catch (error) {
    const raced = await linkedAccount();
    if (raced) return legacyUsername(db, raced.id);
    return uniqueError(error);
  }
}

export function createGuest(db: Database, now: number) {
  return db.transaction((tx) =>
    insertPlayer(
      tx,
      { name: `Khách${String(randomInt(10000)).padStart(4, '0')}`, email: null, passwordHash: null, guest: true },
      now,
    ),
  );
}

export async function setUsername(db: Database, id: string, input: unknown): Promise<PlayerAccount> {
  const username = readUsername((input as { username?: unknown })?.username);
  try {
    return await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, id)).for('update');
      if (player.guest) throw new HttpError(400, 'INVALID_INPUT');
      if (player.username) throw new HttpError(409, 'USERNAME_IMMUTABLE');
      const [updated] = await tx
        .update(players)
        .set({ username, usernameRequired: false })
        .where(eq(players.id, id))
        .returning(account);
      await saveStarterOutfit(tx, id, (input as { outfit?: unknown })?.outfit);
      return updated;
    });
  } catch (error) {
    return uniqueError(error);
  }
}

export async function renamePlayer(db: Database, id: string, input: unknown, now: number): Promise<PlayerAccount> {
  const name = readName((input as { name?: unknown })?.name);
  return db.transaction(async (tx) => {
    const [player] = await tx.select().from(players).where(eq(players.id, id)).for('update');
    const nextAllowedAt = player.lastRenamedAt ? player.lastRenamedAt.getTime() + 7 * 86400_000 : 0;
    if (now < nextAllowedAt) throw new HttpError(429, 'RENAME_TOO_SOON', nextAllowedAt);
    const [updated] = await tx
      .update(players)
      .set({ name, lastRenamedAt: new Date(now) })
      .where(eq(players.id, id))
      .returning(account);
    return updated;
  });
}

export async function accountWithSetup(db: Database, player: PlayerAccount) {
  const [row] = await db.select().from(playerDocuments).where(eq(playerDocuments.playerId, player.id));
  return !player.guest && row && row.document.characterSetupPending !== false
    ? { ...player, characterSetupRequired: true, characterSetupOutfit: sanitizeOutfit(row.document.outfit) }
    : player;
}

export async function completeCharacterSetup(db: Database, player: PlayerAccount, input: unknown, now: number) {
  const body = input as { outfit?: unknown };
  if (player.guest || !body?.outfit || typeof body.outfit !== 'object') throw new HttpError(400, 'INVALID_INPUT');
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(playerDocuments).where(eq(playerDocuments.playerId, player.id)).for('update');
    if (row.document.characterSetupPending === false) return;
    await saveStarterOutfit(tx, player.id, body.outfit, now);
  });
  return player;
}
