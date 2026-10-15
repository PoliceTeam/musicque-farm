import { createGemBattle, isGemBattle, playGemAction } from './gem-battle-logic.js';
import { createMiniMatch, isMiniMatch, type MiniGameId, playMiniAction } from './mini-games-logic.js';
import { createPhomMatch, isPhomMatch, playPhomAction } from './phom-logic.js';
import type { RandomSeed } from './random.js';
import { createTienMatch, isTienMatch, playTienAction } from './tien-len-logic.js';

export const diamondsGame = {
  id: 'diamonds',
  seats: 2,
  create: createGemBattle,
  play: playGemAction,
  validate: isGemBattle,
} as const;
export const tienLenGame = {
  id: 'tien-len',
  seats: 4,
  create: createTienMatch,
  play: playTienAction,
  validate: isTienMatch,
} as const;
export const phomGame = {
  id: 'phom',
  seats: 4,
  create: createPhomMatch,
  play: playPhomAction,
  validate: isPhomMatch,
} as const;

const miniDefinition = (id: MiniGameId) => ({
  id,
  seats: id === 'bau-cua' || id === 'slots' ? 4 : 2,

  create: (requestId: string, roomId: number, seed: RandomSeed, tableId = 0) =>
    createMiniMatch(id, requestId, roomId, seed, tableId),

  play: playMiniAction,
  validate: isMiniMatch,
});

export const bauCuaGame = miniDefinition('bau-cua'),
  slotsGame = miniDefinition('slots'),
  chessGame = miniDefinition('chess'),
  chineseChessGame = miniDefinition('chinese-chess');
export type ArcadeGameId = 'diamonds' | 'tien-len' | 'phom' | MiniGameId;

/** Host adapters are injected; this package never imports React, storage, SDK or app modules. */
export function createArcadeRegistry<Adapter>() {
  const entries = new Map<string, { id: string; seats: number; adapter: Adapter }>();
  return {
    register(definition: { id: string; seats: number }, adapter: Adapter) {
      if (entries.has(definition.id)) throw new Error(`Game already registered: ${definition.id}`);
      entries.set(definition.id, Object.freeze({ id: definition.id, seats: definition.seats, adapter }));
    },

    get(id: string) {
      return entries.get(id);
    },

    list() {
      return [...entries.values()];
    },
  };
}

export * from './session.js';
export * from './table-payout.js';
