import {
  createGemBattle,
  type GemAction,
  type GemBattle,
  gemSeatSnapshot,
  playGemSeatAction,
} from '@chibi-town/arcade-games/gem-battle-logic';
import {
  createMiniMatch,
  type MiniAction,
  type MiniGameId,
  type MiniMatch,
  miniMemberCoinDeltas,
  miniSeatSnapshot,
  playMiniSeatAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import {
  createPhomMatch,
  type PhomAction,
  type PhomMatch,
  type PhomResult,
  phomSeatSnapshot,
  playPhomSeatAction,
} from '@chibi-town/arcade-games/phom-logic';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import {
  createTienMatch,
  playTienSeatAction,
  type TienAction,
  type TienMatch,
  type TienResult,
  tienSeatSnapshot,
} from '@chibi-town/arcade-games/tien-len-logic';
import { validDiamondCommand } from '@chibi-town/contracts/arcade';
import { validMiniCommand } from '@chibi-town/contracts/mini-games';
import { validPhomCommand } from '@chibi-town/contracts/phom';
import { validTienCommand } from '@chibi-town/contracts/tien-len';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { TableGame } from './table-types.js';

export const tienTable: TableGame<TienMatch> = {
  gameId: 'tien-len',
  capacity: 4,
  minPlayers: 2,

  create: (id, roomId, tableId, seed) => createTienMatch(id, roomId, seed, tableId),

  validCommand: (command) => validTienCommand(command as never),

  action: (command) => (command as { action: TienAction }).action,

  play(match, seat, command) {
    const { state, step } = playTienSeatAction(match, seat, (command as { action: TienAction }).action);
    const players = state.session?.playerCount ?? 4;
    return {
      state,

      result: (viewer): TienResult => {
        const snapshot = tienSeatSnapshot(state, viewer);
        return {
          match: snapshot,
          steps: [{ ...step, actor: (step.actor - viewer + players) % players, match: snapshot }],
        };
      },
    };
  },

  snapshot: tienSeatSnapshot,

  deltas: (match, stake, players) =>
    match.placements && match.placements.length >= 2
      ? topTwoPayout(stake, match.placements[0], match.placements[1], players)
      : match.status === 'finished' && match.placements?.length === 1 && match.forfeited?.length === players - 1
        ? players === 2
          ? topTwoPayout(stake, match.winner!, 1 - match.winner!, players)
          : Array.from({ length: 4 }, (_, seat) =>
              seat >= players ? 0 : seat === match.winner ? stake * (players - 1) : -stake,
            )
        : [0, 0, 0, 0],

  winner: (match) => match.winner,

  turn: (match) => match.turn,

  practiceMatch: (document) => document.tien?.activeMatch,

  recordWin(document) {
    document.tien ??= { wins: 0, starts: {}, requests: {} };
    document.tien.wins++;
  },
};

export const phomTable: TableGame<PhomMatch> = {
  gameId: 'phom',
  capacity: 4,
  minPlayers: 2,

  create: (id, roomId, tableId, seed) => createPhomMatch(id, roomId, seed, tableId),

  validCommand: (command) => validPhomCommand(command as never),

  action: (command) => (command as { action: PhomAction }).action,

  play(match, seat, command) {
    const { state, step } = playPhomSeatAction(match, seat, (command as { action: PhomAction }).action);
    return {
      state,

      result: (viewer): PhomResult => {
        const snapshot = phomSeatSnapshot(state, viewer);
        return {
          match: snapshot,
          steps: [
            {
              ...step,
              ...(step.action === 'draw' && viewer !== step.actor ? { card: undefined } : {}),
              actor: (step.actor - viewer + (state.session?.playerCount ?? 4)) % (state.session?.playerCount ?? 4),
              match: snapshot,
            },
          ],
        };
      },
    };
  },

  snapshot: phomSeatSnapshot,

  deltas: (match, stake, players) => topTwoPayout(stake, match.placements![0], match.placements![1], players),

  winner: (match) => match.winner,

  turn: (match) => match.turn,

  practiceMatch: (document) => document.phom?.activeMatch,

  recordWin(document) {
    document.phom ??= { wins: 0, starts: {}, requests: {} };
    document.phom.wins++;
  },
};

export function boardTable(gameId: MiniGameId): TableGame<MiniMatch> {
  return {
    gameId,
    capacity: 2,
    minPlayers: 2,

    create: (id, roomId, tableId, seed) => createMiniMatch(gameId, id, roomId, seed, tableId),

    validCommand: (command) => validMiniCommand(command as never) && (command as { gameId: string }).gameId === gameId,

    action: (command) => (command as { action: MiniAction }).action,

    play(match, seat, command) {
      const { state } = playMiniSeatAction(match, seat, (command as { action: MiniAction }).action);
      return {
        state,

        result: (viewer) => {
          const snapshot = miniSeatSnapshot(state, viewer);
          return { match: snapshot, steps: [snapshot] };
        },
      };
    },

    snapshot: miniSeatSnapshot,

    deltas: (match, stake) =>
      match.outcome === 'draw' ? [0, 0] : match.outcome === 'win' ? [stake, -stake] : [-stake, stake],

    winner: (match) => (match.outcome === 'draw' ? undefined : match.outcome === 'win' ? 0 : 1),

    turn: (match) => match.turn,

    practiceMatch: (document) => document.mini?.[gameId]?.activeMatch,

    recordWin(document) {
      document.mini ??= {};
      document.mini[gameId] ??= { wins: 0, starts: {}, requests: {} };
      document.mini[gameId]!.wins++;
    },
  };
}

export const gemTable: TableGame<GemBattle> = {
  gameId: 'diamonds',
  capacity: 2,
  minPlayers: 2,

  finished: (match) => match.status === 'won' || match.status === 'lost',

  create(id, roomId, tableId, seed) {
    return { ...createGemBattle(id, roomId, seed, tableId), status: 'waiting', turn: 0 };
  },

  validCommand: (command) => validDiamondCommand(command as never),

  action: (command) => (command as { action: GemAction }).action,

  play: (match, seat, command) => playGemSeatAction(match, seat, (command as { action: GemAction }).action),

  snapshot: gemSeatSnapshot,

  deltas: (match, stake) => (match.status === 'won' ? [stake, -stake] : [-stake, stake]),

  winner: (match) => (match.status === 'won' ? 0 : 1),

  turn: (match) => match.turn ?? 0,

  practiceMatch: (document) => {
    const m = document.arcade?.activeBattle;
    return m && { status: m.status === 'won' || m.status === 'lost' ? 'finished' : m.status };
  },

  recordWin(document) {
    document.arcade ??= { bestScore: 0, starts: {}, requests: {} };
    document.arcade.wins = (document.arcade.wins ?? 0) + 1;
  },
};

export function houseGameTable(gameId: 'bau-cua' | 'slots'): TableGame<MiniMatch> {
  return {
    ...boardTable(gameId),
    settlement: 'house',
    capacity: 4,
    minPlayers: 1,

    deltas: (match) => miniMemberCoinDeltas(match).map((payout) => payout.delta),

    winner: () => undefined,
  };
}

export const tableGames: Partial<Record<ArcadeGameId, TableGame>> = {
  slots: houseGameTable('slots') as unknown as TableGame,
  'bau-cua': houseGameTable('bau-cua') as unknown as TableGame,
  diamonds: gemTable as unknown as TableGame,
  'tien-len': tienTable as unknown as TableGame,
  phom: phomTable as unknown as TableGame,
  chess: boardTable('chess') as unknown as TableGame,
  'chinese-chess': boardTable('chinese-chess') as unknown as TableGame,
};
