import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import { createGemBattle, validGemMoves } from '@chibi-town/arcade-games/gem-battle-logic';
import { decodeGemResult } from '@chibi-town/contracts/arcade';
import { expect, it } from 'vitest';

function pair() {
  const repository = createMemoryRepository();
  const local = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://arcade.test',

    fetch: async (url, init) => {
      try {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const data = String(url).endsWith('/configure')
          ? await local.configureArcadeTable(body)
          : String(url).endsWith('/start')
            ? await local.startDiamondRoom(body)
            : String(url).endsWith('/play')
              ? await local.playDiamond(body)
              : String(url).endsWith('/inventory')
                ? await local.getInventory()
                : await local.getArcadeLobby();
        return Response.json(data);
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

async function beginDiamond(
  sdk: ReturnType<typeof createGameSdk>,
  waiting: Awaited<ReturnType<typeof sdk.startDiamondRoom>>,
) {
  await sdk.configureArcadeTable({
    gameId: 'diamonds',
    matchId: waiting.id,
    revision: waiting.revision,
    stake: 100,
    difficulty: 'medium',
    requestId: `configure-${waiting.id}`,
  });
  return (
    await sdk.playDiamond({
      battleId: waiting.id,
      revision: waiting.revision + 1,
      requestId: `begin-${waiting.id}`,
      action: { type: 'start' },
    })
  ).battle;
}

for (const adapter of ['local', 'http'] as const) {
  it(`${adapter}: starts, resumes and replays commands without changing farm or wallet`, async () => {
    const adapters = pair();
    const sdk = adapters[adapter];
    const before = await adapters.local.getInventory();
    const lobby = await sdk.getArcadeLobby();
    expect(lobby.games).toHaveLength(7);
    expect(lobby.games.filter((g) => g.available).map((g) => g.id)).toEqual([
      'tien-len',
      'phom',
      'diamonds',
      'bau-cua',
      'slots',
      'chess',
      'chinese-chess',
    ]);
    const start = { roomId: 0, requestId: 'start-1' };
    const waiting = await sdk.startDiamondRoom(start);
    const battle = await beginDiamond(sdk, waiting);
    const move = validGemMoves(battle.board)[0];
    const command = {
      requestId: 'move-1',
      battleId: battle.id,
      revision: battle.revision,
      action: { type: 'swap' as const, from: move.from, to: move.to },
    };
    const result = await sdk.playDiamond(command);
    expect(await sdk.playDiamond(command)).toEqual(result);
    expect(await sdk.startDiamondRoom({ roomId: 0, requestId: 'resume' })).toEqual(result.battle);
    expect(await sdk.startDiamondRoom(start)).toEqual(waiting);
    expect((await sdk.getArcadeLobby()).bestScore).toBe(result.battle.score);
    await expect(sdk.playDiamond({ ...command, requestId: 'stale' })).rejects.toMatchObject({
      code: 'REQUEST_CONFLICT',
    });
    await expect(sdk.playDiamond({ ...command, action: { type: 'skill' } })).rejects.toMatchObject({
      code: 'REQUEST_CONFLICT',
    });
    expect((await sdk.getInventory()).farm).toEqual(before.farm);
  });
  it(`${adapter}: rejects invalid seats, conflicting matches and reserved request IDs`, async () => {
    const sdk = pair()[adapter];
    await expect(sdk.startDiamondRoom({ roomId: 4, tableId: 0, requestId: 'invalid' })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
    for (const requestId of ['__proto__', 'constructor', 'prototype', ''])
      await expect(sdk.startDiamondRoom({ roomId: 0, requestId })).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    await sdk.startDiamondRoom({ roomId: 0, requestId: 'start' });
    await expect(sdk.startDiamondRoom({ roomId: 1, requestId: 'other' })).rejects.toMatchObject({
      code: 'MATCH_IN_PROGRESS',
    });
  });
}
it('persists an ongoing battle across IndexedDB reload', async () => {
  const name = `arcade-test-${crypto.randomUUID()}`;
  const first = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  const battle = await beginDiamond(first, await first.startDiamondRoom({ roomId: 0, requestId: 'start' }));
  const move = validGemMoves(battle.board)[0];
  const result = await first.playDiamond({
    requestId: 'move',
    battleId: battle.id,
    revision: battle.revision,
    action: { type: 'swap', from: move.from, to: move.to },
  });
  const second = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await second.getArcadeLobby()).activeBattle).toEqual(result.battle);
});
it('rejects corrupted battle results and a response for another battle', async () => {
  const local = pair().local;
  const battle = await beginDiamond(local, await local.startDiamondRoom({ roomId: 0, requestId: 'start' }));
  const move = validGemMoves(battle.board)[0];
  const command = {
    requestId: 'move',
    battleId: battle.id,
    revision: battle.revision,
    action: { type: 'swap' as const, from: move.from, to: move.to },
  };
  const result = await local.playDiamond(command);
  expect(() => decodeGemResult({ ...result, battle: { ...result.battle, board: ['bad'] } })).toThrow();
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://arcade.test',

    fetch: async () => Response.json({ ...result, battle: { ...result.battle, id: 'wrong' } }),
  });
  await expect(http.playDiamond(command)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
});
it('bounds persisted request history while keeping the current battle and farm', async () => {
  const { local, repository } = pair();
  const before = await local.getInventory();
  let battle = await beginDiamond(local, await local.startDiamondRoom({ roomId: 0, requestId: 'start' }));
  for (let turn = 0; turn < 60; turn++) {
    await repository.transaction((document) => {
      const current = document.arcade!.activeBattle!;
      current.player.hp = current.bot.hp = 1000;
      current.status = 'playing';
      current.session = { hostId: 'local-player', mode: 'casual', stake: 0, difficulty: 'medium', configured: true };
    });
    battle = (await local.getArcadeLobby()).activeBattle!;
    const move = validGemMoves(battle.board)[0];
    await local.playDiamond({
      requestId: `turn-${turn}`,
      battleId: battle.id,
      revision: battle.revision,
      action: { type: 'swap', from: move.from, to: move.to },
    });
  }
  const count = await repository.transaction((document) => Object.keys(document.arcade!.requests).length);
  expect(count).toBe(50);
  expect((await local.getInventory()).farm).toEqual(before.farm);
});

for (const adapter of ['local', 'http'] as const) {
  it(`${adapter}: has three real room directories, ten tables each, and only marks the active table occupied`, async () => {
    const sdk = pair()[adapter];
    const before = await sdk.getArcadeLobby();
    expect(before.source).toBe('local');
    expect(before.rooms.map((room) => room.id)).toEqual([0, 1, 2, 3]);
    for (const room of before.rooms.slice(0, 3)) {
      expect(room.tables.map((table) => table.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(room.tables.every((table) => table.occupants === 0 && table.status === 'empty')).toBe(true);
    }
    const battle = await sdk.startDiamondRoom({ roomId: 2, tableId: 9, requestId: 'last-table' });
    expect(battle.roomId).toBe(2);
    expect(battle.tableId).toBe(9);
    const lobby = await sdk.getArcadeLobby();
    expect(lobby.rooms.flatMap((room) => room.tables).filter((table) => table.occupants > 0)).toHaveLength(1);
    expect(lobby.rooms[2].tables[9]).toMatchObject({ occupants: 2, capacity: 2, status: 'waiting' });
    expect(await sdk.startDiamondRoom({ roomId: 2, tableId: 9, requestId: 'resume-table' })).toEqual(battle);
    await expect(sdk.startDiamondRoom({ roomId: 2, tableId: 8, requestId: 'another-table' })).rejects.toMatchObject({
      code: 'MATCH_IN_PROGRESS',
    });
    await expect(sdk.startDiamondRoom({ roomId: 0, tableId: 10, requestId: 'invalid-table' })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
  });
}
it('moves old eight-room saves to tables without losing battle progress', async () => {
  const document = createLocalDocument();
  const battle = createGemBattle('legacy', 7, 42);
  delete battle.tableId;
  battle.player.hp = 321;
  battle.revision = 9;
  document.arcade = { activeBattle: battle, bestScore: 100, starts: {}, requests: {} };
  const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository(document) });
  const lobby = await sdk.getArcadeLobby();
  expect(lobby.activeBattle).toMatchObject({ id: 'legacy', roomId: 0, tableId: 7, revision: 9, player: { hp: 321 } });
  expect(lobby.rooms[0].tables[7].occupants).toBe(2);
});
