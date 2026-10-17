import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from '@/infrastructure/database/schema';

/** Driver-neutral handle; production uses node-postgres, tests use an in-process database. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));

type OpenDatabase = { db: Database; close: () => Promise<void> };

/**
 * `postgres://…` connects to a server. `pglite:<directory>` or `pglite:memory` runs Postgres inside this
 * process for local development without Docker; it needs the dev dependencies and serves one process only.
 */
export async function openDatabase(databaseUrl: string): Promise<OpenDatabase> {
  if (databaseUrl.startsWith('pglite:')) {
    const [{ PGlite }, pglite, migrator] = await Promise.all([
      import('@electric-sql/pglite'),
      import('drizzle-orm/pglite'),
      import('drizzle-orm/pglite/migrator'),
    ]);
    const directory = databaseUrl.slice('pglite:'.length);
    const client = new PGlite(directory === 'memory' ? undefined : directory);
    const db = pglite.drizzle(client, { schema });
    await migrator.migrate(db, { migrationsFolder });
    return {
      db: db as unknown as Database,

      close: () => client.close(),
    };
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  // API and worker may start together; serialize DDL on one dedicated PostgreSQL connection.
  const migrationConnection = await pool.connect();
  try {
    await migrationConnection.query('select pg_advisory_lock(76324903)');
    try {
      await migrate(drizzle(migrationConnection, { schema }), { migrationsFolder });
    } finally {
      await migrationConnection.query('select pg_advisory_unlock(76324903)');
    }
  } catch (error) {
    migrationConnection.release();
    await pool.end();
    throw error;
  }
  migrationConnection.release();
  return {
    db,

    close: () => pool.end(),
  };
}
