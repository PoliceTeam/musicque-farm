import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { TABLE_TURN_LIMIT_MS, type TableGame, type TableRecord } from './table-types.js';

/** Adds the names around the table, in the viewer's seat order, to a snapshot or to every snapshot of a result. */
export function named<T>(record: TableRecord, seat: number, value: T, now = Date.now()): T {
  const participants = record.resultSeats ?? record.seats;
  const viewer = participants.findIndex((entry) => entry.playerId === record.seats[seat].playerId);
  const players = participants.map((_, index) => {
    const entry = participants[(index + viewer) % participants.length];
    return {
      id: entry.playerId,
      name: entry.name,
      username: entry.username ?? null,
      outfit: sanitizeOutfit(entry.outfit),
    };
  });

  const tag = (snapshot: unknown) => ({
    ...(snapshot as object),
    players,
    serverTime: now,
    ...(record.match.status === 'playing' && record.turnStartedAt !== undefined
      ? { turnEndsAt: record.turnStartedAt + TABLE_TURN_LIMIT_MS }
      : {}),
  });

  const result = value as { match?: unknown; battle?: unknown; steps?: unknown[] };
  if (result && typeof result === 'object' && 'battle' in result) return { ...result, battle: tag(result.battle) } as T;
  if (!result || typeof result !== 'object' || !('match' in result)) return tag(value) as T;
  return {
    ...result,
    match: tag(result.match),
    steps: result.steps?.map((step) => {
      const entry = step as { match?: unknown };
      return 'match' in entry ? { ...entry, match: tag(entry.match) } : tag(step);
    }),
  } as T;
}

/** The table as one of its players sees it; undefined for anyone not seated. */
export function viewTable(game: TableGame, record: TableRecord, playerId: string, now = Date.now()) {
  const seat = record.seats.findIndex((entry) => entry.playerId === playerId);
  if (seat < 0) return undefined;
  const viewer =
    record.resultSeats && game.settlement !== 'house'
      ? record.resultSeats.findIndex((entry) => entry.playerId === playerId)
      : seat;
  const snapshot = named(record, seat, game.snapshot(record.match, viewer), now) as object;
  return {
    ...snapshot,
    serverTime: now,
    ...(record.match.status === 'playing' && record.turnStartedAt !== undefined
      ? { turnEndsAt: record.turnStartedAt + TABLE_TURN_LIMIT_MS }
      : {}),
    ...(record.lastSteps
      ? {
          lastSteps: {
            revision: record.lastSteps.revision,
            steps: named(
              record,
              seat,
              {
                match: snapshot,
                steps:
                  record.lastSteps.seats[
                    record.resultSeats?.findIndex((entry) => entry.playerId === playerId) ?? viewer
                  ] ?? [],
              },
              now,
            ).steps,
          },
        }
      : {}),
  };
}
