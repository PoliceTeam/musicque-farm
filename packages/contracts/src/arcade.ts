import { validArcadeRequestId } from './arcade-request.js';

export { validArcadeRequestId } from './arcade-request.js';

import {
  type GemAction,
  type GemBattleSnapshot,
  type GemPublicResult,
  isGemBattleSnapshot,
} from '@chibi-town/arcade-games/gem-battle-logic';
import {
  ARCADE_GAMES,
  ARCADE_PRACTICE_ROOM_ID,
  ARCADE_ROOM_COUNT,
  ARCADE_TABLES_PER_ROOM,
  type ArcadeGameId,
  DIAMOND_RULES,
  validArcadeSeat,
} from '@chibi-town/game-content/arcade-catalog';
import { type ArcadeTableStart, validArcadeStartOptions } from './arcade-table.js';
export type ArcadeLobby = {
  source: 'local' | 'live';
  availableCoins?: number;
  games: readonly { id: ArcadeGameId; available: boolean }[];
  rooms: readonly ArcadeRoom[];
  bestScore: number;
  activeBattle?: GemBattleSnapshot;
};
export type DiamondCommand = { requestId: string; battleId: string; revision: number; action: GemAction };

export function validDiamondStart(value: ArcadeTableStart) {
  return (
    !!value &&
    validArcadeSeat(value.roomId, value.tableId) &&
    validArcadeStartOptions(value) &&
    validArcadeRequestId(value.requestId)
  );
}

export function validDiamondCommand(value: DiamondCommand) {
  return (
    !!value &&
    validArcadeRequestId(value.requestId) &&
    typeof value.battleId === 'string' &&
    value.battleId.length > 0 &&
    value.battleId.length <= 100 &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    !!value.action &&
    (value.action.type === 'skill' ||
      value.action.type === 'start' ||
      (value.action.type === 'swap' &&
        Number.isSafeInteger(value.action.from) &&
        Number.isSafeInteger(value.action.to) &&
        value.action.from >= 0 &&
        value.action.to >= 0 &&
        value.action.from < 64 &&
        value.action.to < 64))
  );
}

export function decodeArcadeLobby(value: unknown): ArcadeLobby {
  const lobby = value as ArcadeLobby;
  if (
    !lobby ||
    !['local', 'live'].includes(lobby.source) ||
    !Array.isArray(lobby.games) ||
    lobby.games.length !== ARCADE_GAMES.length ||
    lobby.games.some(
      (game) => !game || !ARCADE_GAMES.some((entry) => entry.id === game.id) || typeof game.available !== 'boolean',
    ) ||
    new Set(lobby.games.map((game) => game.id)).size !== lobby.games.length ||
    !validArcadeRooms(lobby.rooms, DIAMOND_RULES.roomCapacity) ||
    !Number.isSafeInteger(lobby.bestScore) ||
    lobby.bestScore < 0 ||
    (lobby.activeBattle !== undefined && !isGemBattleSnapshot(lobby.activeBattle))
  )
    throw new Error('Invalid arcade response');
  return lobby;
}

export function decodeGemBattle(value: unknown): GemBattleSnapshot {
  if (!isGemBattleSnapshot(value)) throw new Error('Invalid diamond battle');
  return value;
}

export function decodeGemResult(value: unknown): GemPublicResult {
  const result = value as GemPublicResult;
  if (
    !result ||
    !isGemBattleSnapshot(result.battle) ||
    typeof result.reshuffled !== 'boolean' ||
    !Array.isArray(result.steps) ||
    result.steps.length > 160 ||
    (result.extraTurn !== undefined && typeof result.extraTurn !== 'boolean') ||
    result.steps.some(
      (step) =>
        !step ||
        !['player', 'bot'].includes(step.actor) ||
        !Array.isArray(step.cleared) ||
        step.cleared.some((i) => !Number.isSafeInteger(i) || i < 0 || i >= 64) ||
        new Set(step.cleared).size !== step.cleared.length ||
        ![step.player, step.bot].every(
          (fighter) =>
            fighter &&
            Number.isSafeInteger(fighter.hp) &&
            fighter.hp >= 0 &&
            fighter.hp <= 1000 &&
            Number.isSafeInteger(fighter.mana) &&
            fighter.mana >= 0 &&
            fighter.mana <= 100 &&
            Number.isSafeInteger(fighter.shield) &&
            fighter.shield >= 0 &&
            fighter.shield <= 300,
        ) ||
        (step.extraTurn !== undefined && typeof step.extraTurn !== 'boolean') ||
        (step.reshuffled !== undefined && typeof step.reshuffled !== 'boolean') ||
        (step.luckReward !== undefined && !['heal', 'mana', 'shield'].includes(step.luckReward)) ||
        (step.beforeBoard !== undefined && !isGemBattleSnapshot({ ...result.battle, board: step.beforeBoard })) ||
        !Array.isArray(step.board) ||
        !isGemBattleSnapshot({ ...result.battle, board: step.board }) ||
        ![step.damage, step.healed, step.combo, step.score].every((n) => Number.isSafeInteger(n) && n >= 0),
    )
  )
    throw new Error('Invalid diamond result');
  return result;
}

export type ArcadeTable = { id: number; occupants: number; capacity: number; status: 'empty' | 'waiting' | 'playing' };
export type ArcadeRoom = { id: number; tables: readonly ArcadeTable[] };

export function validArcadeRooms(value: unknown, capacity: number): value is ArcadeRoom[] {
  if (!Array.isArray(value) || value.length !== ARCADE_ROOM_COUNT) return false;
  return (
    value.every(
      (room) =>
        room &&
        Number.isSafeInteger(room.id) &&
        room.id >= 0 &&
        room.id < ARCADE_ROOM_COUNT &&
        Array.isArray(room.tables) &&
        room.tables.length === (room.id === ARCADE_PRACTICE_ROOM_ID ? 20 : ARCADE_TABLES_PER_ROOM) &&
        room.tables.every(
          (table: ArcadeTable) =>
            table &&
            validArcadeSeat(room.id, table.id) &&
            table.capacity === capacity &&
            Number.isSafeInteger(table.occupants) &&
            table.occupants >= 0 &&
            table.occupants <= capacity &&
            ['empty', 'waiting', 'playing'].includes(table.status) &&
            (table.status !== 'empty' || table.occupants === 0),
        ) &&
        new Set(room.tables.map((table: ArcadeTable) => table.id)).size ===
          (room.id === ARCADE_PRACTICE_ROOM_ID ? 20 : ARCADE_TABLES_PER_ROOM),
    ) && new Set(value.map((room) => room.id)).size === ARCADE_ROOM_COUNT
  );
}
