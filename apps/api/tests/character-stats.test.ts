import { readFile } from 'node:fs/promises';
import { decodeCharacterStats } from '@chibi-town/contracts/character-stats';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { migrationsFolder } from '@/infrastructure/database/database';
import { players } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

const zero = { experience: 0, fashion: 0, friendliness: 0, happiness: 0, mischief: 0, health: 0 };
let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(() => t.close());

it('persists points per account, exposes only the session owner and keeps them through outfit commands', async () => {
  const a = await t.register('stats_a');
  const b = await t.register('stats_b');
  const sdk = t.sdkFor(a.cookie);
  expect((await sdk.getPlayer()).stats).toEqual(zero);
  const stats = { experience: 5_000_000_000, fashion: 30, friendliness: 12, happiness: 18, mischief: 2, health: 100 };
  await t.db
    .update(players)
    .set({ ...stats, level: 9 })
    .where(eq(players.id, a.player.id));
  const profile = await sdk.getPlayer();
  expect(profile.stats).toEqual(stats);
  expect(profile.level).toBe(9);
  expect((await t.sdkFor(b.cookie).getPlayer()).stats).toEqual(zero);
  await sdk.execute({ type: 'equip-outfit', outfit: profile.outfit, requestId: 'keep-stats', mapInstanceId: 'home' });
  expect((await sdk.getPlayer()).stats).toEqual(stats);
  const [stored] = await t.db.select().from(players).where(eq(players.id, a.player.id));
  expect(stored.experience).toBe(stats.experience);
});

it('enforces point ranges in the database and rejects malformed API points', async () => {
  const a = await t.register('stats_limits');
  for (const key of Object.keys(zero) as (keyof typeof zero)[]) {
    await expect(
      t.db
        .update(players)
        .set({ [key]: -1 })
        .where(eq(players.id, a.player.id)),
    ).rejects.toThrow();
    expect(() => decodeCharacterStats({ ...zero, [key]: -1 })).toThrow();
    expect(() => decodeCharacterStats({ ...zero, [key]: 0.5 })).toThrow();
  }
  await expect(
    t.db.update(players).set({ experience: 9007199254740992 }).where(eq(players.id, a.player.id)),
  ).rejects.toThrow();
  expect(() => decodeCharacterStats({ ...zero, health: 2147483648 })).toThrow();
  expect(() => decodeCharacterStats({ experience: 0 })).toThrow();
  expect(() => decodeCharacterStats(null)).toThrow();
});

it('backfills an existing account without resetting its level or name', async () => {
  const legacy = new PGlite();
  try {
    const journal = JSON.parse(await readFile(`${migrationsFolder}/meta/_journal.json`, 'utf8')) as {
      entries: { tag: string }[];
    };
    const before = journal.entries.filter((entry) => entry.tag < '0009');
    for (const entry of before) await legacy.exec(await readFile(`${migrationsFolder}/${entry.tag}.sql`, 'utf8'));
    await legacy.exec(
      "INSERT INTO players (id, name, level) VALUES ('00000000-0000-4000-8000-000000000001', 'Existing', 9)",
    );
    const migration = journal.entries.find((entry) => entry.tag.startsWith('0009_'))!;
    await legacy.exec(await readFile(`${migrationsFolder}/${migration.tag}.sql`, 'utf8'));
    const result = await legacy.query(
      'SELECT name, level, experience::float8 AS experience, fashion, friendliness, happiness, mischief, health FROM players',
    );
    expect(result.rows).toEqual([{ name: 'Existing', level: 9, ...zero }]);
  } finally {
    await legacy.close();
  }
});
