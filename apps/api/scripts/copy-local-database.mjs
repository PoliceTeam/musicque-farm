import { getTableName } from 'drizzle-orm';
import { openDatabase } from '../dist/infrastructure/database/database.js';
import * as schema from '../dist/infrastructure/database/schema.js';

// Run from apps/api with its HTTP server stopped. Never modifies or deletes the source folder.
const sourceUrl = process.env.SOURCE_DATABASE_URL ?? 'pglite:.data/dev';
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl.startsWith('pglite:') || !/^postgres(?:ql)?:/.test(targetUrl ?? ''))
  throw new Error('Set SOURCE_DATABASE_URL=pglite:<folder> and TARGET_DATABASE_URL=postgres://...');
const source = await openDatabase(sourceUrl);
let target;
try {
  target = await openDatabase(targetUrl);
  const tables = [
    schema.players,
    schema.identities,
    schema.sessions,
    schema.playerDocuments,
    schema.characterInventories,
    schema.characterUnlocks,
    schema.characterInstances,
    schema.characterGrants,
    schema.arcadeTables,
    schema.arcadeSeats,
    schema.petRaceConfig,
    schema.petRaceRounds,
    schema.petRaceBets,
  ];
  const counts = await target.db.transaction(async (tx) => {
    // Check every table before copying. Refuse to merge into any existing application data.
    for (const table of tables) {
      if ((await tx.select().from(table).limit(1)).length)
        throw new Error(`Target ${getTableName(table)} is not empty; copy aborted`);
    }
    const copied = {};
    for (const table of tables) {
      const rows = await source.db.select().from(table);
      for (let offset = 0; offset < rows.length; offset += 100)
        await tx.insert(table).values(rows.slice(offset, offset + 100));
      copied[getTableName(table)] = rows.length;
    }
    return copied;
  });
  console.info('Copied application rows in one transaction:', counts);
} finally {
  await target?.close();
  await source.close();
}
