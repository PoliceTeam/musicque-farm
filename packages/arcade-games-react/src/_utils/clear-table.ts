import type { ArcadeRoom } from '@chibi-town/contracts/arcade';

export function clearTable(rooms: readonly ArcadeRoom[], match?: { roomId: number; tableId?: number }) {
  return rooms.map((room) => ({
    ...room,
    tables: room.tables.map((table) =>
      room.id === match?.roomId && table.id === (match.tableId ?? 0)
        ? { ...table, occupants: 0, status: 'empty' as const }
        : table,
    ),
  }));
}
