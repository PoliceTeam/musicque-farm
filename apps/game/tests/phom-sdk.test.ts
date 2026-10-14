import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import { type PhomMatch, phomBotAction } from '@chibi-town/arcade-games/phom-logic';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import { expect, it } from 'vitest';

function pair() {
  const document = createLocalDocument();
  document.farm.coins = 1000;
  const repository = createMemoryRepository(document);
  const local = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://phom.test',

    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname,
        input = init?.body ? JSON.parse(String(init.body)) : undefined;
      try {
        const result =
          path === '/arcade/phom/start'
            ? await local.startPhomRoom(input)
            : path === '/arcade/phom/play'
              ? await local.playPhom(input)
              : path === '/arcade/table/configure'
                ? await local.configureArcadeTable(input)
                : path === '/arcade/table/leave'
                  ? await local.leaveArcadeTable(input)
                  : await local.getPhomLobby();
        return Response.json(result);
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

for (const mode of ['local', 'http'] as const)
  it(`${mode}: creates real rooms, supports host setup, reserves funds and penalizes leaving once`, async () => {
    const env = pair(),
      sdk = env[mode];
    const lobby = await sdk.getPhomLobby();
    expect(lobby.rooms.map((r) => r.tables.length)).toEqual([10, 10, 10, 20]);
    const m = await sdk.startPhomRoom({ roomId: 0, tableId: 2, requestId: 'join' });
    expect((await sdk.getPhomLobby()).rooms[0].tables[2].occupants).toBe(4);
    await expect(
      sdk.playPhom({ matchId: m.id, revision: 0, requestId: 'too-early', action: { type: 'start' } }),
    ).rejects.toThrow('NOT_ALLOWED');
    await expect(
      sdk.configureArcadeTable({
        gameId: 'phom',
        matchId: m.id,
        revision: 0,
        requestId: 'too-rich',
        stake: 1001,
        difficulty: 'easy',
        playerCount: 3,
      }),
    ).rejects.toThrow('INSUFFICIENT_COINS');
    await sdk.configureArcadeTable({
      gameId: 'phom',
      matchId: m.id,
      revision: 0,
      requestId: 'config',
      stake: 100,
      difficulty: 'hard',
      playerCount: 3,
    });
    const command = { matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } as const };
    const result = await sdk.playPhom(command);
    expect(await sdk.playPhom(command)).toEqual(result);
    expect((await sdk.getPhomLobby()).availableCoins).toBe(900);
    expect((await env.local.getTienLobby()).availableCoins).toBe(900);
    const leave = { gameId: 'phom' as const, matchId: m.id, revision: 2, requestId: 'leave' };
    expect((await sdk.leaveArcadeTable(leave)).coinDelta).toBe(-100);
    expect((await sdk.leaveArcadeTable(leave)).coinDelta).toBe(-100);
    expect((await env.local.getInventory()).farm.coins).toBe(900);
    expect((await sdk.getPhomLobby()).rooms[0].tables[2].occupants).toBe(0);
  });
for (const roomId of [0, 3])
  it(`settles full Phom games once in room ${roomId}, including rank payouts`, async () => {
    const { local: sdk, repository } = pair();
    let m = await sdk.startPhomRoom({ roomId, requestId: 'join' });
    await sdk.configureArcadeTable({
      gameId: 'phom',
      matchId: m.id,
      revision: m.revision,
      requestId: 'config',
      stake: roomId === 3 ? 0 : 100,
      difficulty: 'medium',
      playerCount: 4,
    });
    m = (await sdk.playPhom({ matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } })).match;
    for (let i = 0; m.status === 'playing'; i++) {
      expect(i).toBeLessThan(40);
      const state = await repository.transaction((d) => d.phom!.activeMatch as PhomMatch);
      const command = { matchId: m.id, revision: m.revision, requestId: `turn-${i}`, action: phomBotAction(state) };
      const r = await sdk.playPhom(command);
      expect(await sdk.playPhom(command)).toEqual(r);
      m = r.match;
    }
    const expected = roomId === 3 ? 0 : topTwoPayout(100, m.placements![0], m.placements![1], 4)[0];
    expect(m.session?.coinDelta).toBe(expected);
    expect((await sdk.getInventory()).farm.coins).toBe(1000 + expected);
    await sdk.leaveArcadeTable({ gameId: 'phom', matchId: m.id, revision: m.revision, requestId: 'leave-finished' });
    expect((await sdk.getInventory()).farm.coins).toBe(1000 + expected);
  });
it('waiting tables exit free, practice has no wager, and stale/malformed commands do not mutate state', async () => {
  const { local: sdk } = pair();
  let m = await sdk.startPhomRoom({ roomId: 0, requestId: 'wait' });
  expect(
    (await sdk.leaveArcadeTable({ gameId: 'phom', matchId: m.id, revision: 0, requestId: 'free-leave' })).coinDelta,
  ).toBe(0);
  m = await sdk.startPhomRoom({ roomId: 3, requestId: 'practice' });
  await expect(
    sdk.configureArcadeTable({
      gameId: 'phom',
      matchId: m.id,
      revision: 0,
      requestId: 'bad-stake',
      stake: 1,
      difficulty: 'medium',
    }),
  ).rejects.toThrow('INSUFFICIENT_COINS');
  await expect(
    sdk.playPhom({ matchId: m.id, revision: 5, requestId: 'stale', action: { type: 'start' } }),
  ).rejects.toThrow('REQUEST_CONFLICT');
  await expect(
    sdk.playPhom({ matchId: m.id, revision: 0, requestId: 'bad', action: { type: 'discard', card: 99 } }),
  ).rejects.toThrow('INVALID_COMMAND');
  expect((await sdk.getInventory()).farm.coins).toBe(1000);
});
it('persists practice match across browser repository instances without exposing other hands', async () => {
  const name = `phom-save-${crypto.randomUUID()}`;
  const first = createGameSdk({
    adapter: 'local',
    repository: createBrowserRepository({ name }),

    clock: () => 42,
  });
  const m = await first.startPhomRoom({ roomId: 3, tableId: 8, requestId: 'persist' });
  await first.configureArcadeTable({
    gameId: 'phom',
    matchId: m.id,
    revision: 0,
    requestId: 'config',
    stake: 0,
    difficulty: 'medium',
  });
  const playing = (await first.playPhom({ matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } }))
    .match;
  const second = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await second.getPhomLobby()).activeMatch).toEqual(playing);
  expect(playing).not.toHaveProperty('hands');
});
it('HTTP rejects malformed snapshots and mismatched responses', async () => {
  const bad = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://phom.test',

    fetch: async () => Response.json({ status: 'playing' }),
  });
  await expect(bad.getPhomLobby()).rejects.toThrow('NETWORK_ERROR');
  await expect(bad.startPhomRoom({ roomId: 3, requestId: 'invalid' })).rejects.toThrow('NETWORK_ERROR');
});
it('recovers malformed persisted Phom data without breaking the wallet or other games', async () => {
  const d = createLocalDocument();
  d.phom = {
    wins: 0,
    starts: {},
    requests: {},
    activeMatch: { hands: [[], [], [], []], stock: [], seed: 42 } as unknown as PhomMatch,
  };
  const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository(d) });
  expect((await sdk.getPhomLobby()).activeMatch).toBeUndefined();
  expect((await sdk.getInventory()).farm.coins).toBeGreaterThanOrEqual(0);
});
it('blocks non-host configuration/start and leaves active practice free', async () => {
  const { local: sdk, repository } = pair();
  const m = await sdk.startPhomRoom({ roomId: 3, requestId: 'host' });
  await repository.transaction((d) => {
    d.phom!.activeMatch!.session!.hostId = 'someone-else';
  });
  await expect(
    sdk.configureArcadeTable({
      gameId: 'phom',
      matchId: m.id,
      revision: 0,
      requestId: 'blocked',
      stake: 0,
      difficulty: 'medium',
    }),
  ).rejects.toThrow('NOT_ALLOWED');
  await repository.transaction((d) => {
    d.phom!.activeMatch!.session!.hostId = 'local-player';
  });
  await sdk.configureArcadeTable({
    gameId: 'phom',
    matchId: m.id,
    revision: 0,
    requestId: 'okay',
    stake: 0,
    difficulty: 'easy',
  });
  const r = await sdk.playPhom({ matchId: m.id, revision: 1, requestId: 'go', action: { type: 'start' } });
  expect(
    (
      await sdk.leaveArcadeTable({
        gameId: 'phom',
        matchId: m.id,
        revision: r.match.revision,
        requestId: 'practice-leave',
      })
    ).coinDelta,
  ).toBe(0);
  expect((await sdk.getInventory()).farm.coins).toBe(1000);
});
