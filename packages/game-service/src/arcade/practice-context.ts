import type { MiniGameId } from '@chibi-town/arcade-games/mini-games-logic';
import type { RandomSeed } from '@chibi-town/arcade-games/random';
import { type ArcadeSession, arcadeAllReady } from '@chibi-town/arcade-games/session';
import { ApiSdkError } from '@chibi-town/contracts';
import type { ArcadeRoom } from '@chibi-town/contracts/arcade';
import { ARCADE_PRACTICE_ROOM_ID, ARCADE_ROOMS } from '@chibi-town/game-content/arcade-catalog';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import { pruneReceipts } from '../receipt-order.js';
import type { GameServiceOptions } from '../service-types.js';

export function createPracticeContext(options: GameServiceOptions) {
  const clock = options.clock;

  const randomSeed = (): RandomSeed => {
    if (options.randomSeed) return options.randomSeed();
    if (options.random) {
      const word = () => {
        const value = options.random!();
        if (!Number.isFinite(value) || value < 0 || value >= 1) throw new ApiSdkError('INVALID_COMMAND');
        return Math.floor(value * 4294967296);
      };

      return [word(), word(), word(), word()];
    }
    return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))) as [number, number, number, number];
  };

  const lobbySource = options.live ? ('live' as const) : ('local' as const);

  const arcade = (document: PlayerDocument) => (document.arcade ??= { bestScore: 0, starts: {}, requests: {} });

  const prune = pruneReceipts;

  const localHostId = options.player.id;

  const reservedCoins = reservedArcadeCoins;

  const botAvailable = (document: PlayerDocument, id: string, gameId: string) => {
    const reserved = Object.entries(document.mini ?? {}).reduce((sum, [game, state]) => {
      const match = state?.activeMatch;
      if (game === gameId || match?.status !== 'playing' || match.session?.mode !== 'wager' || match.session.settled)
        return sum;
      return sum + (match.session.members?.find((member) => member.id === id)?.stake ?? 0);
    }, 0);
    return Math.max(0, (document.arcadeBotCoins?.[id] ?? 10000) - reserved);
  };

  const settle = (document: PlayerDocument, match: { session?: ArcadeSession }, won: boolean, deltas?: number[]) => {
    const session = match.session;
    if (!session || session.settled) return;
    const delta = session.mode === 'wager' ? (deltas ? deltas[0] : won ? session.stake : -session.stake) : 0;
    const coins = document.farm.coins + delta;
    if (!Number.isSafeInteger(coins) || coins < 0) throw new ApiSdkError('INSUFFICIENT_COINS');
    document.farm.coins = coins;
    session.settled = true;
    session.coinDelta = delta;
    if (deltas) session.coinDeltas = session.mode === 'wager' ? deltas : [0, 0, 0, 0];
    if (delta) document.revision++;
  };

  const sessionFor = (roomId: number, difficulty?: ArcadeSession['difficulty']): ArcadeSession => ({
    hostId: localHostId,
    mode: roomId === ARCADE_PRACTICE_ROOM_ID ? 'practice' : 'wager',
    stake: 0,
    configured: false,
    difficulty: difficulty ?? 'medium',
  });

  const checkStart = (document: PlayerDocument, session?: ArcadeSession) => {
    if (
      session &&
      (session.hostId !== localHostId || session.configured === false || (session.members && !arcadeAllReady(session)))
    )
      throw new ApiSdkError('NOT_ALLOWED');
    if (
      session?.mode === 'wager' &&
      (session.stake < 1 || session.stake > document.farm.coins - reservedCoins(document))
    )
      throw new ApiSdkError('INSUFFICIENT_COINS');
  };

  const tableDirectory = (
    capacity: number,
    active?: { roomId: number; tableId?: number; status: string; session?: ArcadeSession },
  ): ArcadeRoom[] =>
    ARCADE_ROOMS.map((room) => ({
      id: room.id,
      tables: room.tableIds.map((id) => {
        const occupied =
          active &&
          active.roomId === room.id &&
          (active.tableId ?? 0) === id &&
          ['playing', 'waiting'].includes(active.status);
        return {
          id,
          capacity,
          occupants: occupied
            ? (active.session?.members?.length ?? (capacity === 4 ? (active.session?.playerCount ?? 4) : capacity))
            : 0,
          status: occupied ? (active.status === 'waiting' ? 'waiting' : 'playing') : 'empty',
        };
      }),
    }));

  const phom = (document: PlayerDocument) => (document.phom ??= { wins: 0, starts: {}, requests: {} });

  const tien = (document: PlayerDocument) => (document.tien ??= { wins: 0, starts: {}, requests: {} });

  const mini = (document: PlayerDocument, gameId: MiniGameId) => {
    document.mini ??= {};
    document.mini[gameId] ??= { wins: 0, starts: {}, requests: {} };
    return document.mini[gameId]!;
  };

  return {
    clock,
    randomSeed,
    lobbySource,
    localHostId,
    reservedCoins,
    prune,
    botAvailable,
    settle,
    sessionFor,
    checkStart,
    tableDirectory,
    arcade,
    phom,
    tien,
    mini,
  };
}

export type PracticeContext = ReturnType<typeof createPracticeContext>;
