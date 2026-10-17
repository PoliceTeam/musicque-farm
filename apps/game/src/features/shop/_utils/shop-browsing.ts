export type ShopPage = { history: (string | undefined)[]; index: number };
export const FIRST_SHOP_PAGE: ShopPage = { history: [undefined], index: 0 };

/** Each tab retains its cursor chain; revisiting a product does not jump back to page one. */
export function changeShopPage(page: ShopPage, direction: 'previous' | 'next', nextCursor?: string | null): ShopPage {
  if (direction === 'previous') return page.index > 0 ? { ...page, index: page.index - 1 } : page;
  if (!nextCursor) return page;
  return { history: [...page.history.slice(0, page.index + 1), nextCursor], index: page.index + 1 };
}
