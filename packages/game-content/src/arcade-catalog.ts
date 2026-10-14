export const ARCADE_GAMES = [
  { id: 'tien-len', available: true },
  { id: 'phom', available: true },
  { id: 'diamonds', available: true },
  { id: 'bau-cua', available: true },
  { id: 'slots', available: true },
  { id: 'chess', available: true },
  { id: 'chinese-chess', available: true },
] as const;
export type ArcadeGameId = (typeof ARCADE_GAMES)[number]['id'];
export const DIAMOND_RULES = {
  size: 8,
  health: 1000,
  mana: 100,
  shield: 300,
  skillCost: 60,
  attack: 45,
  heal: 24,
  manaPerGem: 12,
  shieldPerGem: 18,
  cascadeBonus: 10,
  skillDamage: 210,
  maxBonusTurns: 3,
  rooms: 3,
  roomCapacity: 2,
} as const;

export const ARCADE_ROOM_COUNT = 4;
export const ARCADE_PRACTICE_ROOM_ID = 3;
export const ARCADE_TABLES_PER_ROOM = 10;
export const ARCADE_ROOMS = Array.from({ length: ARCADE_ROOM_COUNT }, (_, id) => ({
  id,
  practice: id === ARCADE_PRACTICE_ROOM_ID,
  tableIds: Array.from(
    { length: id === ARCADE_PRACTICE_ROOM_ID ? 20 : ARCADE_TABLES_PER_ROOM },
    (_, tableId) => tableId,
  ),
}));

export function validArcadeSeat(roomId: number, tableId = 0) {
  return (
    Number.isSafeInteger(roomId) &&
    roomId >= 0 &&
    roomId < ARCADE_ROOM_COUNT &&
    Number.isSafeInteger(tableId) &&
    tableId >= 0 &&
    tableId < (roomId === ARCADE_PRACTICE_ROOM_ID ? 20 : ARCADE_TABLES_PER_ROOM)
  );
}

/** Legacy eight-room saves map to the first room, tables 0–7. */
export function validSavedArcadeSeat(roomId: number, tableId?: number) {
  return tableId === undefined
    ? Number.isSafeInteger(roomId) && roomId >= 0 && roomId < 8
    : validArcadeSeat(roomId, tableId);
}
