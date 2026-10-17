import { DEFAULT_RACE_CONFIG } from '@chibi-town/contracts/pet-racing';
import type {
  CharacterCosmeticInstance,
  CosmeticGrant,
  CosmeticOwnership,
} from '@chibi-town/game-content/cosmetic-economy';
import type { PlayerDocument, TableRecord } from '@chibi-town/game-service';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

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

export const characterInventories = pgTable(
  'character_inventories',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(),
    bagSlots: integer('bag_slots').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.characterId] }),
    check('character_bag_slots_positive', sql`${table.bagSlots} > 0`),
  ],
);

export const characterUnlocks = pgTable(
  'character_cosmetic_unlocks',
  {
    playerId: uuid('player_id').notNull(),
    characterId: text('character_id').notNull(),
    cosmeticId: text('cosmetic_id').notNull(),
    data: json('data').$type<CosmeticOwnership>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.characterId, table.cosmeticId] }),
    foreignKey({
      columns: [table.playerId, table.characterId],
      foreignColumns: [characterInventories.playerId, characterInventories.characterId],
    }).onDelete('cascade'),
  ],
);

export const characterInstances = pgTable(
  'character_item_instances',
  {
    playerId: uuid('player_id').notNull(),
    characterId: text('character_id').notNull(),
    instanceId: text('instance_id').notNull(),
    container: text('container').notNull(),
    bagSlot: integer('bag_slot'),
    equippedSlot: text('equipped_slot'),
    data: json('data').$type<CharacterCosmeticInstance>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.characterId, table.instanceId] }),
    foreignKey({
      columns: [table.playerId, table.characterId],
      foreignColumns: [characterInventories.playerId, characterInventories.characterId],
    }).onDelete('cascade'),
    uniqueIndex('character_one_bag_slot').on(table.playerId, table.characterId, table.bagSlot),
    uniqueIndex('character_one_equipped_slot').on(table.playerId, table.characterId, table.equippedSlot),
    check(
      'character_item_location',
      sql`(${table.container} = 'bag' AND ${table.bagSlot} >= 0 AND ${table.bagSlot} IS NOT NULL AND ${table.equippedSlot} IS NULL) OR (${table.container} = 'equipped' AND ${table.equippedSlot} IS NOT NULL AND ${table.bagSlot} IS NULL) OR (${table.container} = 'warehouse' AND ${table.bagSlot} IS NULL AND ${table.equippedSlot} IS NULL)`,
    ),
  ],
);

export const characterGrants = pgTable(
  'character_cosmetic_grants',
  {
    playerId: uuid('player_id').notNull(),
    characterId: text('character_id').notNull(),
    grantId: text('grant_id').notNull(),
    data: json('data').$type<CosmeticGrant>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.characterId, table.grantId] }),
    foreignKey({
      columns: [table.playerId, table.characterId],
      foreignColumns: [characterInventories.playerId, characterInventories.characterId],
    }).onDelete('cascade'),
  ],
);

/** One immutable outcome per global clock slot; never exposed while wagering is open. */
export const petRaceRounds = pgTable('pet_race_rounds', {
  announcedPhase: integer('announced_phase').notNull().default(-1),
  id: text('id').primaryKey(),
  record: json('record').$type<import('@chibi-town/game-service/arcade/pet-racing-round').PetRaceRound>().notNull(),
});

/** Settlement queue; money and idempotency remain in the locked player document. */
export const petRaceBets = pgTable(
  'pet_race_bets',
  {
    roundId: text('round_id')
      .notNull()
      .references(() => petRaceRounds.id),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    settled: boolean('settled').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.roundId, table.playerId] }),
    index('pet_race_pending').on(table.settled, table.endsAt),
  ],
);

/** One editable configuration; each new round persists an immutable copy of its derived odds. */
export const petRaceConfig = pgTable(
  'pet_race_config',
  {
    id: text('id').primaryKey().default('default'),
    chances: json('chances').$type<number[]>().notNull().default(DEFAULT_RACE_CONFIG.chances),
    returnRateBps: integer('return_rate_bps').notNull().default(DEFAULT_RACE_CONFIG.returnRateBps),
    lastResetDay: text('last_reset_day'),
  },
  (table) => [
    check('pet_race_config_singleton', sql`${table.id} = 'default'`),
    check('pet_race_config_return_rate', sql`${table.returnRateBps} > 0 AND ${table.returnRateBps} <= 10000`),
  ],
);
