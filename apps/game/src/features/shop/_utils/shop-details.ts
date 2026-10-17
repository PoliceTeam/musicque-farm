import type { CharacterInventoryPage, CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';

/** A group can outgrow one API page when more palettes are introduced. Keep following its cursors. */
export async function loadShopDetails(
  read: (query: CharacterInventoryQuery) => Promise<CharacterInventoryPage>,
  query: CharacterInventoryQuery,
  active: () => boolean,
): Promise<CharacterInventoryPage | undefined> {
  const first = await read({ ...query, cursor: undefined, limit: 50 });
  if (!active()) return;
  const rows = [...first.rows];
  const seen = new Set<string>();
  let cursor = first.nextCursor;
  while (cursor) {
    if (seen.has(cursor)) throw new Error('Repeated shop detail cursor');
    seen.add(cursor);
    const page = await read({ ...query, cursor, limit: 50 });
    if (!active()) return;
    rows.push(...page.rows);
    cursor = page.nextCursor;
  }
  return { ...first, rows, nextCursor: null };
}
