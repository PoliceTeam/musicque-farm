import type { PlayerDocument, TableRecord } from '@chibi-town/game-service';
import { boolean, integer, json, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  username: text('username').unique(),
  usernameRequired: boolean('username_required').notNull().default(false),
  registrationBonusAt: timestamp('registration_bonus_at', { withTimezone: true }),
  lastRenamedAt: timestamp('last_renamed_at', { withTimezone: true }),
  level: integer('level').notNull().default(1),
  email: text('email').unique(),
  guest: boolean('guest').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  /** Null for accounts that only sign in through an external provider. */
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const identities = pgTable(
  'identities',
  {
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.provider, table.subject] })],
);

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  playerId: uuid('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** `json`, not `jsonb`: receipt pruning in the game service drops the oldest keys and relies on key order. */
export const playerDocuments = pgTable('player_documents', {
  playerId: uuid('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),
  document: json('document').$type<PlayerDocument>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Tables of people that are open right now. A row exists only while someone sits there. */
export const arcadeTables = pgTable(
  'arcade_tables',
  {
    id: uuid('id').primaryKey(),
    gameId: text('game_id').notNull(),
    /** Entertainment-street channel; every channel has its own rooms and tables. */
    channel: integer('channel').notNull(),
    roomId: integer('room_id').notNull(),
    tableId: integer('table_id').notNull(),
    record: json('record').$type<TableRecord>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('arcade_tables_address').on(table.gameId, table.channel, table.roomId, table.tableId)],
);

/** One seat per player and game, so a player cannot sit at two tables of the same game. */
export const arcadeSeats = pgTable(
  'arcade_seats',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    gameId: text('game_id').notNull(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => arcadeTables.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.gameId] })],
);
