import { ARCADE_PRACTICE_ROOM_ID } from '@chibi-town/game-content/arcade-catalog';

/** Display numbers are separate from persisted room IDs. */
export function roomNumber(roomId: number) {
  return roomId === ARCADE_PRACTICE_ROOM_ID ? 0 : roomId + 1;
}
