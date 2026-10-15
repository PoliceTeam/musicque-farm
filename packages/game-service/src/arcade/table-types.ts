import type { RandomSeed } from '@chibi-town/arcade-games/random';
import type { ArcadeSession } from '@chibi-town/arcade-games/session';
import type { Outfit } from '@chibi-town/character-core/character-types';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { PlayerDocument } from '../player-document.js';

export const TABLE_TURN_LIMIT_MS = 60_000;

export type TableMatch = {
  id: string;
  seed?: RandomSeed;
  roomId: number;
  tableId?: number;
  revision: number;
  status: string;
  session?: ArcadeSession;
};

export type TableSeat = { playerId: string; name: string; username?: string | null; guest?: boolean; outfit?: Outfit };

/** A table of people. Seat order is join order; seat 0 is the host. Stored once on the server, not per player. */
export type TableRecord<M extends TableMatch = TableMatch> = {
  gameId: ArcadeGameId;
  departedPlayerIds?: string[];
  turnStartedAt?: number;
  lastSteps?: { revision: number; seats: unknown[][] };
  match: M;
  seats: TableSeat[];
  /** Original participants remain named and indexed on the result screen after someone leaves. */
  resultSeats?: TableSeat[];
  /** Last answers per player, so a retried request returns what the first attempt returned. */
  receipts: Record<string, Record<string, { fingerprint: string; result: unknown }>>;
};

/** What a game supplies so the shared table rules can run it. */
export type TableGame<M extends TableMatch = TableMatch> = {
  gameId: ArcadeGameId;
  capacity: number;
  finished?(match: M): boolean;
  settlement?: 'house';
  minPlayers: number;
  create(id: string, roomId: number, tableId: number, seed: RandomSeed): M;
  validCommand(command: unknown): boolean;
  action(command: unknown): { type: string };
  /** Applies one seat's action; throws `Error(code)` for an illegal one. */
  play(match: M, seat: number, command: unknown): { state: M; result: (viewer: number) => unknown };
  snapshot(match: M, viewer: number): unknown;
  /** Coin change per seat. House games settle each bet independently. */
  deltas(match: M, stake: number, players: number): number[];
  winner(match: M): number | undefined;
  /** Seat that has to act while the match is in play. */
  turn(match: M): number;
  recordWin(document: PlayerDocument): void;
  /** The player's own practice match of this game, which also counts as their one match. */
  practiceMatch(document: PlayerDocument): { status: string } | undefined;
};

/** Saves of every seated player plus the caller, locked by the caller for the whole operation. */
export type TableWallets = ReadonlyMap<string, PlayerDocument>;

export type TableOutcome<T> = { record: TableRecord | null; result: T; changed: boolean };
