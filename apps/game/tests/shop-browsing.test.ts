import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { expect, it } from 'vitest';
import { changeShopPage, FIRST_SHOP_PAGE } from '@/features/shop/_utils/shop-browsing';
import { loadShopDetails } from '@/features/shop/_utils/shop-details';

it('retains independent cursor chains, restores old pages and discards an obsolete forward branch', () => {
  const hair = changeShopPage(FIRST_SHOP_PAGE, 'next', 'hair/9');
  const shirts = changeShopPage(FIRST_SHOP_PAGE, 'next', 'shirt/9');
  const third = changeShopPage(hair, 'next', 'hair/18');
  expect(hair).toEqual({ index: 1, history: [undefined, 'hair/9'] });
  expect(shirts.history[shirts.index]).toBe('shirt/9');
  const previous = changeShopPage(third, 'previous');
  const replacement = changeShopPage(previous, 'next', 'hair/new18');
  expect(replacement.history).toEqual([undefined, 'hair/9', 'hair/new18']);
  expect(third.history).toEqual([undefined, 'hair/9', 'hair/18']);
  expect(changeShopPage(FIRST_SHOP_PAGE, 'previous')).toBe(FIRST_SHOP_PAGE);
  expect(changeShopPage(hair, 'next', null)).toBe(hair);
});

it('loads every palette page and stops requesting when the selection has changed', async () => {
  const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository(createLocalDocument()) });
  const page = await sdk.getCharacterInventory({ view: 'shop', shop: 'salon', groupId: 'item/hair.slick' });
  const cursors: (string | undefined)[] = [];
  const combined = await loadShopDetails(
    async (query) => {
      cursors.push(query.cursor);
      return query.cursor
        ? { ...page, rows: page.rows.slice(3), nextCursor: null }
        : { ...page, rows: page.rows.slice(0, 3), nextCursor: 'next' };
    },
    { view: 'shop', groupId: 'item/hair.slick' },
    () => true,
  );
  expect(cursors).toEqual([undefined, 'next']);
  expect(combined?.rows).toEqual(page.rows);
  let requests = 0;
  expect(
    await loadShopDetails(
      async () => {
        requests++;
        return { ...page, nextCursor: 'next' };
      },
      { view: 'shop' },
      () => false,
    ),
  ).toBeUndefined();
  expect(requests).toBe(1);
  await expect(
    loadShopDetails(
      async () => ({ ...page, nextCursor: 'loop' }),
      { view: 'shop' },
      () => true,
    ),
  ).rejects.toThrow('Repeated shop detail cursor');
});
