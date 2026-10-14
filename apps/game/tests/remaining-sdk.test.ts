import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import {
  legalMiniMoves,
  MINI_GAME_IDS,
  type MiniGameId,
  type MiniMatch,
  miniCoinDelta,
} from '@chibi-town/arcade-games/mini-games-logic';
import { expect, it } from 'vitest';

function pair() {
  const d = createLocalDocument();
  d.farm.coins = 1000;
  const repository = createMemoryRepository(d);
  const local = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://mini.test',

    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname,
        input = init?.body ? JSON.parse(String(init.body)) : undefined;
      try {
        const id = path.split('/')[3] as MiniGameId;
        const result = path.endsWith('/start')
          ? await local.startMiniRoom(input)
          : path.endsWith('/play')
            ? await local.playMini(input)
            : path.endsWith('/configure')
              ? await local.configureArcadeTable(input)
              : path.endsWith('/leave')
                ? await local.leaveArcadeTable(input)
                : await local.getMiniLobby(id);
        return Response.json(result);
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

for (const gameId of MINI_GAME_IDS)
  for (const transport of ['local', 'http'] as const)
    it(`${transport} ${gameId}: rooms, host setup, start, retry and leave settle exactly once`, async () => {
      const env = pair(),
        sdk = env[transport];
      expect((await sdk.getMiniLobby(gameId)).rooms.map((r) => r.tables.length)).toEqual([10, 10, 10, 20]);
      const m = await sdk.startMiniRoom({ gameId, roomId: 0, tableId: 3, requestId: 'join' });
      await expect(
        sdk.playMini({ gameId, matchId: m.id, revision: 0, requestId: 'unconfigured', action: { type: 'start' } }),
      ).rejects.toThrow('NOT_ALLOWED');
      const config = {
        gameId,
        matchId: m.id,
        revision: 0,
        requestId: 'configure',
        stake: 100,
        difficulty: 'easy' as const,
      };
      await sdk.configureArcadeTable(config);
      const command = { gameId, matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } as const };
      const result = await sdk.playMini(command);
      expect(await sdk.playMini(command)).toEqual(result);
      expect((await sdk.getMiniLobby(gameId)).availableCoins).toBe(900);
      expect((await env.local.getPhomLobby()).availableCoins).toBe(900);
      const leave = { gameId, matchId: m.id, revision: 2, requestId: 'leave' };
      expect((await sdk.leaveArcadeTable(leave)).coinDelta).toBe(-100);
      expect(await sdk.leaveArcadeTable(leave)).toEqual({ coins: 900, coinDelta: -100 });
      expect((await env.local.getInventory()).farm.coins).toBe(900);
      expect((await sdk.getMiniLobby(gameId)).activeMatch).toBeUndefined();
    });
for (const gameId of ['bau-cua', 'slots'] as const)
  it(`${gameId}: result payout and receipt retry do not pay twice`, async () => {
    const { local: sdk } = pair();
    const m = await sdk.startMiniRoom({ gameId, roomId: 0, requestId: 'join' });
    await sdk.configureArcadeTable({
      gameId,
      matchId: m.id,
      revision: 0,
      requestId: 'config',
      stake: 100,
      difficulty: 'medium',
    });
    await sdk.playMini({ gameId, matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } });
    const command = {
      gameId,
      matchId: m.id,
      revision: 2,
      requestId: 'result',
      action: gameId === 'bau-cua' ? { type: 'roll' as const, symbol: 0 } : { type: 'spin' as const },
    };
    const r = await sdk.playMini(command);
    expect(await sdk.playMini(command)).toEqual(r);
    expect(r.match.session?.settled).toBe(true);
    expect((await sdk.getInventory()).farm.coins).toBe(1000 + miniCoinDelta(r.match));
    const before = (await sdk.getInventory()).farm.coins;
    await sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: 3, requestId: 'done-leave' });
    expect((await sdk.getInventory()).farm.coins).toBe(before);
  });
for (const gameId of MINI_GAME_IDS)
  it(`${gameId}: waiting and active practice exits are free`, async () => {
    const { local: sdk } = pair();
    let m = await sdk.startMiniRoom({ gameId, roomId: 0, requestId: 'waiting' });
    expect(
      (await sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: 0, requestId: 'leave-waiting' })).coinDelta,
    ).toBe(0);
    m = await sdk.startMiniRoom({ gameId, roomId: 3, requestId: 'practice' });
    await sdk.configureArcadeTable({
      gameId,
      matchId: m.id,
      revision: 0,
      requestId: 'config',
      stake: 0,
      difficulty: 'medium',
    });
    await sdk.playMini({ gameId, matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } });
    expect((await sdk.leaveArcadeTable({ gameId, matchId: m.id, revision: 2, requestId: 'leave' })).coinDelta).toBe(0);
    expect((await sdk.getInventory()).farm.coins).toBe(1000);
  });
it('new games share reservation limits, reject stale/conflicting requests and restrict host setup', async () => {
  const { local: sdk, repository } = pair();
  const m = await sdk.startMiniRoom({ gameId: 'chess', roomId: 0, requestId: 'chess' });
  await sdk.configureArcadeTable({
    gameId: 'chess',
    matchId: m.id,
    revision: 0,
    requestId: 'config',
    stake: 800,
    difficulty: 'easy',
  });
  await sdk.playMini({ gameId: 'chess', matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } });
  const s = await sdk.startMiniRoom({ gameId: 'slots', roomId: 0, requestId: 'slots' });
  await expect(
    sdk.configureArcadeTable({
      gameId: 'slots',
      matchId: s.id,
      revision: 0,
      requestId: 'too-rich',
      stake: 201,
      difficulty: 'medium',
    }),
  ).rejects.toThrow('INSUFFICIENT_COINS');
  await expect(
    sdk.playMini({ gameId: 'chess', matchId: m.id, revision: 0, requestId: 'stale', action: { type: 'resign' } }),
  ).rejects.toThrow('REQUEST_CONFLICT');
  await expect(sdk.startMiniRoom({ gameId: 'chess', roomId: 1, requestId: 'chess' })).rejects.toThrow(
    'REQUEST_CONFLICT',
  );
  await repository.transaction((d) => {
    d.mini!.slots!.activeMatch!.session!.hostId = 'not-you';
  });
  await expect(
    sdk.configureArcadeTable({
      gameId: 'slots',
      matchId: s.id,
      revision: 0,
      requestId: 'wrong-host',
      stake: 100,
      difficulty: 'medium',
    }),
  ).rejects.toThrow('NOT_ALLOWED');
});
it('a legal chess move survives IndexedDB reload and wrong-game HTTP responses are rejected', async () => {
  const name = `mini-${crypto.randomUUID()}`,
    sdk = createGameSdk({
      adapter: 'local',
      repository: createBrowserRepository({ name }),

      clock: () => 42,
    });
  const m = await sdk.startMiniRoom({ gameId: 'chess', roomId: 3, tableId: 2, requestId: 'join' });
  await sdk.configureArcadeTable({
    gameId: 'chess',
    matchId: m.id,
    revision: 0,
    requestId: 'config',
    stake: 0,
    difficulty: 'easy',
  });
  const playing = (
    await sdk.playMini({ gameId: 'chess', matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } })
  ).match;
  const moved = (
    await sdk.playMini({
      gameId: 'chess',
      matchId: m.id,
      revision: 2,
      requestId: 'move',
      action: { type: 'move', ...legalMiniMoves(playing)[0] },
    })
  ).match;
  const second = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await second.getMiniLobby('chess')).activeMatch).toEqual(moved);
  const wrong = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://bad.test',

    fetch: async () => Response.json(await sdk.getMiniLobby('chess')),
  });
  await expect(wrong.getMiniLobby('slots')).rejects.toThrow('NETWORK_ERROR');
});
it('corrupt new-game saves are removed without breaking inventory', async () => {
  const d = createLocalDocument();
  d.mini = {
    chess: { wins: 0, starts: {}, requests: {}, activeMatch: { board: [], seed: 1 } as unknown as MiniMatch },
  };
  const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository(d) });
  expect((await sdk.getMiniLobby('chess')).activeMatch).toBeUndefined();
  expect((await sdk.getInventory()).farm.coins).toBeGreaterThanOrEqual(0);
});
it('chess checkmate pays once and repetition draw returns the wager without charging', async () => {
  const { chessBoard, chessIndex, loadChess } = await import('@chibi-town/arcade-games/chess-logic');
  const env = pair(),
    sdk = env.local;
  const m = await sdk.startMiniRoom({ gameId: 'chess', roomId: 0, requestId: 'mate' });
  await sdk.configureArcadeTable({
    gameId: 'chess',
    matchId: m.id,
    revision: 0,
    requestId: 'config',
    stake: 100,
    difficulty: 'easy',
  });
  await sdk.playMini({ gameId: 'chess', matchId: m.id, revision: 1, requestId: 'start', action: { type: 'start' } });

  const cm = (from: string, to: string) => ({ from: chessIndex(from), to: chessIndex(to) });

  const moves = [cm('e2', 'e4'), cm('e7', 'e5'), cm('d1', 'h5'), cm('b8', 'c6'), cm('f1', 'c4'), cm('g8', 'f6')];
  await env.repository.transaction((d) => {
    const state = d.mini!.chess!.activeMatch!;
    state.moves = moves;
    state.board = chessBoard(loadChess(moves));
  });
  const command = {
    gameId: 'chess' as const,
    matchId: m.id,
    revision: 2,
    requestId: 'mate-play',
    action: { type: 'move' as const, ...cm('h5', 'f7') },
  };
  const r = await sdk.playMini(command);
  expect(r.match.outcome).toBe('win');
  expect(r.match.reason).toBe('checkmate');
  expect(r.match.session?.coinDelta).toBe(100);
  expect(await sdk.playMini(command)).toEqual(r);
  expect((await sdk.getInventory()).farm.coins).toBe(1100);
  const n = await sdk.startMiniRoom({ gameId: 'chess', roomId: 0, requestId: 'draw' });
  await sdk.configureArcadeTable({
    gameId: 'chess',
    matchId: n.id,
    revision: 0,
    requestId: 'draw-config',
    stake: 100,
    difficulty: 'easy',
  });
  await sdk.playMini({
    gameId: 'chess',
    matchId: n.id,
    revision: 1,
    requestId: 'draw-start',
    action: { type: 'start' },
  });
  const cycle = [cm('g1', 'f3'), cm('g8', 'f6'), cm('f3', 'g1'), cm('f6', 'g8')],
    history = [...cycle, ...cycle];
  await env.repository.transaction((d) => {
    const state = d.mini!.chess!.activeMatch!;
    state.moves = history;
    state.board = chessBoard(loadChess(history));
  });
  const draw = await sdk.playMini({
    gameId: 'chess',
    matchId: n.id,
    revision: 2,
    requestId: 'draw-play',
    action: { type: 'move', ...cm('g1', 'f3') },
  });
  expect(draw.match.outcome).toBe('draw');
  expect(draw.match.session?.coinDelta).toBe(0);
  expect((await sdk.getInventory()).farm.coins).toBe(1100);
});
