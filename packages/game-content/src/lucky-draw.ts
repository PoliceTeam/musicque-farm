/** The server owns prices and odds; the browser uses these definitions only to explain the draw. */
export const LUCKY_TICKET_PRICE = 15_000;
export const LUCKY_DRAW_ID = 'fairy-wings-v1';
export const LUCKY_EXCLUSIVE_ITEMS = ['item/wings.pixie'] as const;
export const LUCKY_DUPLICATE_COINS = 30_000;
export const LUCKY_PRIZES = [
  { id: 'coins-1000', kind: 'coins', amount: 1000, weight: 25 },
  { id: 'coins-3000', kind: 'coins', amount: 3000, weight: 24 },
  { id: 'coins-5000', kind: 'coins', amount: 5000, weight: 20 },
  { id: 'ticket-1', kind: 'tickets', amount: 1, weight: 15 },
  { id: 'coins-10000', kind: 'coins', amount: 10000, weight: 7 },
  { id: 'ticket-2', kind: 'tickets', amount: 2, weight: 4 },
  { id: 'coins-30000', kind: 'coins', amount: 30000, weight: 3 },
  { id: 'pixie-wings', kind: 'cosmetic', cosmeticId: 'item/wings.pixie', weight: 2 },
] as const;
