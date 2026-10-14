import { expect, it } from 'vitest';
import { turnSeconds, unseenTableSteps } from '../../../packages/arcade-games-react/src/_utils/table-updates';

it('corrects the countdown for browser clocks ahead of or behind the server, and clamps expired turns', () => {
  for (const receivedAt of [10_000, 9_000_000_000_000]) {
    expect(turnSeconds(160_000, 100_000, receivedAt, receivedAt)).toBe(60);
    expect(turnSeconds(160_000, 100_000, receivedAt, receivedAt + 50_000)).toBe(10);
    expect(turnSeconds(160_000, 100_000, receivedAt, receivedAt + 70_000)).toBe(0);
  }
});
it('does not replay on initial load, reload, duplicates or a different table; replays a newer revision once', () => {
  const snapshot = { id: 'table', revision: 5, lastSteps: { revision: 5, steps: ['move', 'cascade'] } };
  expect(unseenTableSteps(undefined, snapshot)).toEqual([]);
  expect(unseenTableSteps(snapshot, snapshot)).toEqual([]);
  expect(unseenTableSteps({ id: 'other', revision: 4 }, snapshot)).toEqual([]);
  expect(unseenTableSteps({ id: 'table', revision: 4 }, snapshot)).toEqual(['move', 'cascade']);
  expect(unseenTableSteps(snapshot, { ...snapshot, revision: 6 })).toEqual([]);
  expect(unseenTableSteps({ id: 'table', revision: 4 }, { ...snapshot, revision: 3 })).toEqual([]);
});

it('disambiguates repeated display names with immutable usernames', async () => {
  const { tablePlayerName } = await import('@chibi-town/arcade-games/table-snapshot');
  expect(tablePlayerName({ name: 'Lan', username: 'lan.01' })).toBe('Lan @lan.01');
  expect(tablePlayerName({ name: 'Lan', username: 'other_user' })).toBe('Lan @other_user');
  expect(tablePlayerName({ name: 'Khách', username: null })).toBe('Khách');
});

it('opens the host registration prompt for ACCOUNT_REQUIRED while preserving the SDK failure', async () => {
  const { ApiSdkError } = await import('@chibi-town/contracts');
  const { accountRequiredSdk } = await import('@/features/arcade/_utils/account-required-sdk');
  const { createGameSdk } = await import('@chibi-town/api-sdk');
  let prompted = 0;
  const sdk = accountRequiredSdk(
    createGameSdk({
      adapter: 'http',
      baseUrl: 'https://api.test/api',

      fetch: async () => new Response('{"code":"ACCOUNT_REQUIRED"}', { status: 403 }),
    }),
    () => {
      prompted++;
    },
  );
  await expect(sdk.startTienRoom({ roomId: 0, requestId: 'guest-table' })).rejects.toBeInstanceOf(ApiSdkError);
  await expect(sdk.startTienRoom({ roomId: 0, requestId: 'guest-table' })).rejects.toMatchObject({
    code: 'ACCOUNT_REQUIRED',
  });
  expect(prompted).toBe(2);
});
