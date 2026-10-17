import { randomInt } from 'node:crypto';
import { ApiSdkError } from '@chibi-town/contracts';
import { DEFAULT_RACE_CONFIG, LEGACY_RACE_ODDS, racePhase, raceRoundTiming } from '@chibi-town/contracts/pet-racing';
import { createPetRaceRound } from '@chibi-town/game-service/arcade/pet-racing-round';
import { and, eq, isNull, lt, lte } from 'drizzle-orm';
import { DEFAULT_PET_RACE_RESET, type PetRaceResetConfig } from '@/config';
import type { Database } from '@/infrastructure/database/database';
import { petRaceBets, petRaceConfig, petRaceRounds } from '@/infrastructure/database/schema';
import { raceResetDay } from '@/modules/arcade/pet-racing/reset-policy';
import type { PlayerTransaction } from '@/modules/player';

/** Persist the day claim with the reset itself, so concurrent instances cannot reset edits twice. */
export async function maintainRaceConfig(
  db: Database,
  now: number,
  policy: PetRaceResetConfig = DEFAULT_PET_RACE_RESET,
) {
  const day = raceResetDay(now, policy);
  await db
    .insert(petRaceConfig)
    .values({ id: 'default', lastResetDay: policy.enabled ? day : null })
    .onConflictDoNothing();
  if (!policy.enabled) return false;
  // Existing installations establish today's baseline without discarding a custom configuration.
  await db
    .update(petRaceConfig)
    .set({ lastResetDay: day })
    .where(and(eq(petRaceConfig.id, 'default'), isNull(petRaceConfig.lastResetDay)));
  const reset = await db
    .update(petRaceConfig)
    .set({ ...DEFAULT_RACE_CONFIG, lastResetDay: day })
    .where(and(eq(petRaceConfig.id, 'default'), lt(petRaceConfig.lastResetDay, day)))
    .returning({ id: petRaceConfig.id });
  return reset.length > 0;
}

export async function ensureRaceRound(
  tx: PlayerTransaction,
  now: number,
  policy: PetRaceResetConfig = DEFAULT_PET_RACE_RESET,
) {
  const id = raceRoundTiming(now).id;
  const existing = await findRaceRound(tx, id);
  if (existing) return existing;
  await maintainRaceConfig(tx, now, policy);
  const [config] = await tx.select().from(petRaceConfig).where(eq(petRaceConfig.id, 'default'));
  if (!config) throw new ApiSdkError('STORAGE_UNAVAILABLE');
  const record = createPetRaceRound(now, () => randomInt(4294967296) / 4294967296, config);
  await tx.insert(petRaceRounds).values({ id, record }).onConflictDoNothing();
  return (await findRaceRound(tx, id))!;
}

export async function findRaceRound(tx: PlayerTransaction, id: string) {
  const [row] = await tx.select().from(petRaceRounds).where(eq(petRaceRounds.id, id));
  if (!row) return undefined;
  if (row.record.odds) return row.record;
  const record = { ...row.record, odds: LEGACY_RACE_ODDS };
  await tx.update(petRaceRounds).set({ record }).where(eq(petRaceRounds.id, id));
  return record;
}

export function queueRaceBet(tx: PlayerTransaction, playerId: string, roundId: string, endsAt: number) {
  return tx
    .insert(petRaceBets)
    .values({ playerId, roundId, endsAt: new Date(endsAt) })
    .onConflictDoNothing();
}

export function markRaceSettled(tx: PlayerTransaction, playerId: string, roundId: string) {
  return tx
    .update(petRaceBets)
    .set({ settled: true })
    .where(and(eq(petRaceBets.playerId, playerId), eq(petRaceBets.roundId, roundId)));
}

export function pendingRacePlayers(db: Database, now: number) {
  return db
    .select({ playerId: petRaceBets.playerId })
    .from(petRaceBets)
    .where(and(eq(petRaceBets.settled, false), lte(petRaceBets.endsAt, new Date(now))))
    .limit(100);
}

/** Claim a monotonic public phase; the immutable outcome never leaves the snapshot API. */
export async function takeRacePhaseChange(db: Database, now: number, policy: PetRaceResetConfig) {
  return db.transaction(async (tx) => {
    const record = await ensureRaceRound(tx, now, policy);
    const phase = racePhase(record, now);
    const index = ['betting', 'countdown', 'racing', 'results'].indexOf(phase);
    const changed = await tx
      .update(petRaceRounds)
      .set({ announcedPhase: index })
      .where(and(eq(petRaceRounds.id, record.id), lt(petRaceRounds.announcedPhase, index)))
      .returning({ id: petRaceRounds.id });
    return changed.length ? { type: 'pet-race.changed' as const, roundId: record.id, phase } : undefined;
  });
}
