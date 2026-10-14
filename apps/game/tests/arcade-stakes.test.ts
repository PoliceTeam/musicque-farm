import type { ArcadeSession } from '@chibi-town/arcade-games/session';
import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import { createArcadeRegistry, diamondsGame, tienLenGame, topTwoPayout } from '@chibi-town/arcade-games';
import type { GameSdk } from '@chibi-town/contracts';
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
    baseUrl: 'https://tables.test',

    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname,
        input = init?.body ? JSON.parse(String(init.body)) : undefined;
      try {
        const result =
          path === '/arcade/table/configure'
            ? await local.configureArcadeTable(input)
            : path === '/arcade/table/leave'
              ? await local.leaveArcadeTable(input)
              : path === '/arcade/diamonds/start'
                ? await local.startDiamondRoom(input)
                : path === '/arcade/diamonds/play'
                  ? await local.playDiamond(input)
                  : path === '/arcade/tien-len/start'
                    ? await local.startTienRoom(input)
                    : path === '/arcade/tien-len/play'
                      ? await local.playTien(input)
                      : path === '/arcade/tien-len'
                        ? await local.getTienLobby()
                        : path === '/inventory'
                          ? await local.getInventory()
                          : await local.getArcadeLobby();
        return Response.json(result);
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

async function prepare(
  sdk: GameSdk,
  gameId: 'diamonds' | 'tien-len',
  roomId = 0,
  stake = 100,
  playerCount: 2 | 3 | 4 = 4,
) {
  const match =
    gameId === 'diamonds'
      ? await sdk.startDiamondRoom({ roomId, tableId: 0, prepare: true, requestId: 'join' })
      : await sdk.startTienRoom({ roomId, tableId: 0, prepare: true, requestId: 'join' });
  const input = {
    gameId,
    matchId: match.id,
    revision: match.revision,
    requestId: 'configure',
    stake: roomId === 3 ? 0 : stake,
    difficulty: 'hard' as const,
    ...(gameId === 'tien-len' ? { playerCount } : {}),
  };
  const result = await sdk.configureArcadeTable(input);
  expect(await sdk.configureArcadeTable(input)).toEqual(result);
  return { ...match, revision: match.revision + 1, session: result.session };
}

for (const adapter of ['local', 'http'] as const)
  for (const gameId of ['diamonds', 'tien-len'] as const) {
    it(`${adapter}/${gameId}: leaves waiting tables free and debits a started stake exactly once`, async () => {
      const sdk = pair()[adapter];
      let match: { id: string; revision: number; session?: ArcadeSession } = await prepare(sdk, gameId);
      expect((await sdk.getInventory()).farm.coins).toBe(1000);
      if (gameId === 'diamonds')
        match = (
          await sdk.playDiamond({
            battleId: match.id,
            requestId: 'begin',
            revision: match.revision,
            action: { type: 'start' },
          })
        ).battle;
      else
        match = (
          await sdk.playTien({
            matchId: match.id,
            requestId: 'begin',
            revision: match.revision,
            action: { type: 'start' },
          })
        ).match as typeof match;
      const input = { gameId, matchId: match.id, revision: match.revision, requestId: 'leave' };
      const result = await sdk.leaveArcadeTable(input);
      expect(result).toMatchObject({ coins: 900, coinDelta: -100 });
      expect(await sdk.leaveArcadeTable(input)).toEqual(result);
      expect((await sdk.getInventory()).farm.coins).toBe(900);
    });
    it(`${adapter}/${gameId}: practice offers twenty tables, keeps difficulty and never charges on exit`, async () => {
      const sdk = pair()[adapter];
      const match = await prepare(sdk, gameId, 3);
      expect(match.session).toMatchObject({ mode: 'practice', stake: 0, difficulty: 'hard', hostId: 'local-player' });
      const lobby = gameId === 'diamonds' ? await sdk.getArcadeLobby() : await sdk.getTienLobby();
      expect(lobby.rooms[3].tables).toHaveLength(20);
      const begun =
        gameId === 'diamonds'
          ? (
              await sdk.playDiamond({
                battleId: match.id,
                revision: match.revision,
                requestId: 'practice-begin',
                action: { type: 'start' },
              })
            ).battle
          : (
              await sdk.playTien({
                matchId: match.id,
                revision: match.revision,
                requestId: 'practice-begin',
                action: { type: 'start' },
              })
            ).match;
      const result = await sdk.leaveArcadeTable({
        gameId,
        matchId: begun.id,
        revision: begun.revision,
        requestId: 'free-exit',
      });
      expect(result).toMatchObject({ coins: 1000, coinDelta: 0 });
    });
  }
for (const gameId of ['diamonds', 'tien-len'] as const)
  it(`${gameId}: only the host can start after saving settings, including free practice`, async () => {
    const { local, repository } = pair();
    const match =
      gameId === 'diamonds'
        ? await local.startDiamondRoom({ roomId: 3, requestId: 'join' })
        : await local.startTienRoom({ roomId: 3, requestId: 'join' });

    const start = () =>
      gameId === 'diamonds'
        ? local.playDiamond({ battleId: match.id, revision: 0, requestId: 'begin', action: { type: 'start' } })
        : local.playTien({ matchId: match.id, revision: 0, requestId: 'begin', action: { type: 'start' } });

    await expect(start()).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await repository.transaction((document) => {
      const session = (gameId === 'diamonds' ? document.arcade!.activeBattle! : document.tien!.activeMatch!).session!;
      session.configured = true;
      session.hostId = 'guest';
    });
    await expect(start()).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect((await local.getInventory()).farm.coins).toBe(1000);
    const active =
      gameId === 'diamonds' ? (await local.getArcadeLobby()).activeBattle : (await local.getTienLobby()).activeMatch;
    expect(active?.status).toBe('waiting');
  });
it('enforces host ownership and affordability before starting; waiting exit is free', async () => {
  const { local, repository } = pair();
  const match = await local.startDiamondRoom({ roomId: 0, tableId: 0, prepare: true, requestId: 'join' });
  const input = {
    gameId: 'diamonds' as const,
    matchId: match.id,
    revision: 0,
    requestId: 'configure',
    stake: 1001,
    difficulty: 'medium' as const,
  };
  await expect(local.configureArcadeTable(input)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
  await repository.transaction((document) => {
    document.arcade!.activeBattle!.session!.hostId = 'other-player';
  });
  await expect(local.configureArcadeTable({ ...input, stake: 100 })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await repository.transaction((document) => {
    document.arcade!.activeBattle!.session!.hostId = 'local-player';
  });
  expect(
    await local.leaveArcadeTable({ gameId: 'diamonds', matchId: match.id, revision: 0, requestId: 'leave-waiting' }),
  ).toMatchObject({ coins: 1000, coinDelta: 0 });
});
for (const won of [true, false])
  it(`settles a diamond ${won ? 'win' : 'loss'} once and does not charge again on exit`, async () => {
    const { local, repository } = pair();
    const match = await prepare(local, 'diamonds');
    const begun = await local.playDiamond({
      battleId: match.id,
      revision: match.revision,
      requestId: 'begin',
      action: { type: 'start' },
    });
    await repository.transaction((document) => {
      const battle = document.arcade!.activeBattle!;
      battle.player.mana = 60;
      battle.bot.shield = 0;
      if (won) battle.bot.hp = 1;
      else {
        battle.player.hp = 1;
        battle.bot.mana = 60;
      }
    });
    const command = {
      battleId: begun.battle.id,
      revision: begun.battle.revision,
      requestId: 'finish',
      action: { type: 'skill' as const },
    };
    const result = await local.playDiamond(command);
    expect(result.battle.status).toBe(won ? 'won' : 'lost');
    expect(result.battle.session).toMatchObject({ settled: true, coinDelta: won ? 100 : -100 });
    expect((await local.getInventory()).farm.coins).toBe(won ? 1100 : 900);
    expect(await local.playDiamond(command)).toEqual(result);
    expect(
      await local.leaveArcadeTable({
        gameId: 'diamonds',
        matchId: result.battle.id,
        revision: result.battle.revision,
        requestId: 'leave-finished',
      }),
    ).toMatchObject({ coinDelta: 0 });
  });
it('holds stake affordability against farm spending until the wager settles', async () => {
  const { local } = pair();
  const match = await prepare(local, 'diamonds', 0, 950);
  await local.playDiamond({
    battleId: match.id,
    revision: match.revision,
    requestId: 'begin',
    action: { type: 'start' },
  });
  expect((await local.getArcadeLobby()).availableCoins).toBe(50);
  await expect(
    local.execute({
      type: 'buy-seeds',
      mapInstanceId: 'home',
      requestId: 'spend-reserved',
      cropId: 'strawberry',
      count: 20,
    }),
  ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
  expect((await local.getInventory()).farm.coins).toBe(1000);
});
it('persists wagers and their one-time exit receipts across IndexedDB reload', async () => {
  const repository = createBrowserRepository({ name: `stake-${crypto.randomUUID()}` });
  await repository.transaction((document) => {
    document.farm.coins = 1000;
  });
  const sdk = createGameSdk({ adapter: 'local', repository });
  const waiting = await prepare(sdk, 'diamonds');
  const { battle } = await sdk.playDiamond({
    battleId: waiting.id,
    revision: waiting.revision,
    requestId: 'begin',
    action: { type: 'start' },
  });
  const input = { gameId: 'diamonds' as const, matchId: battle.id, revision: battle.revision, requestId: 'leave' };
  const receipt = await sdk.leaveArcadeTable(input);
  const next = createGameSdk({ adapter: 'local', repository });
  expect(await next.leaveArcadeTable(input)).toEqual(receipt);
  expect((await next.getInventory()).farm.coins).toBe(900);
});
it('registers multiple game adapters and rejects duplicate registrations', () => {
  const registry = createArcadeRegistry<string>();
  registry.register(diamondsGame, 'diamond-ui');
  registry.register(tienLenGame, 'cards-ui');
  expect(registry.list().map((entry) => entry.id)).toEqual(['diamonds', 'tien-len']);
  expect(registry.get('tien-len')?.adapter).toBe('cards-ui');
  expect(() => registry.register(diamondsGame, 'again')).toThrow('already registered');
});

for (const won of [true, false])
  it(`keeps legacy Tiến lên ${won ? 'win' : 'loss'} settlement unchanged`, async () => {
    const { local, repository } = pair();
    const waiting = await prepare(local, 'tien-len');
    const { match } = await local.playTien({
      matchId: waiting.id,
      revision: waiting.revision,
      requestId: 'begin',
      action: { type: 'start' },
    });
    let card = 0;
    await repository.transaction((document) => {
      const state = document.tien!.activeMatch!;
      state.session!.payoutRule = undefined;
      state.turn = 0;
      state.opening = false;
      state.passed = [];
      state.lastPlayer = undefined;
      state.pile = undefined;
      if (won) {
        const discarded = state.hands[0].splice(1);
        state.played.push(...discarded);
        card = state.hands[0][0];
      } else {
        state.hands = [
          Array.from({ length: 13 }, (_, i) => i),
          [51],
          Array.from({ length: 13 }, (_, i) => i + 13),
          Array.from({ length: 13 }, (_, i) => i + 26),
        ];
        state.played = Array.from({ length: 12 }, (_, i) => i + 39);
        state.pile = { kind: 'single', cards: [39], high: 39 };
        state.lastPlayer = 0;
      }
    });
    const command = {
      matchId: match.id,
      revision: match.revision,
      requestId: 'finish',
      action: won ? { type: 'play' as const, cards: [card] } : { type: 'pass' as const },
    };
    const result = await local.playTien(command);
    expect(result.match.status).toBe('finished');
    expect(result.match.session).toMatchObject({ settled: true, coinDelta: won ? 100 : -100 });
    expect((await local.getInventory()).farm.coins).toBe(won ? 1100 : 900);
    expect(await local.playTien(command)).toEqual(result);
  });

it('splits the four-player pool without creating xu, including integer rounding', () => {
  expect(topTwoPayout(100, 0, 1, 2)).toEqual([100, -100, 0, 0]);
  expect(topTwoPayout(100, 0, 1, 3)).toEqual([140, -40, -100, 0]);
  expect(topTwoPayout(100, 0, 1)).toEqual([140, 60, -100, -100]);
  for (const stake of [0, 1, 2, 3, 99, 101, 1000, Math.floor(Number.MAX_SAFE_INTEGER / 4)]) {
    const deltas = topTwoPayout(stake, 3, 2);
    expect(deltas.every(Number.isSafeInteger)).toBe(true);
    expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBe(0);
    expect(deltas[0]).toBe(-stake);
    expect(deltas[2]).toBeGreaterThanOrEqual(0);
  }
  expect(() => topTwoPayout(100, 0, 0)).toThrow('INVALID_PAYOUT');
  expect(() => topTwoPayout(Number.MAX_SAFE_INTEGER, 0, 1)).toThrow('INVALID_PAYOUT');
});
for (const adapter of ['local', 'http'] as const)
  for (const roomId of [0, 3])
    for (const rank of [1, 2, 3])
      it(`${adapter}/room ${roomId}: pays Tiến lên rank ${rank} once after the top two are known`, async () => {
        const context = pair(),
          sdk = context[adapter];
        const waiting = await prepare(sdk, 'tien-len', roomId);
        const { match } = await sdk.playTien({
          matchId: waiting.id,
          revision: waiting.revision,
          requestId: 'begin',
          action: { type: 'start' },
        });
        await context.repository.transaction((document) => {
          const state = document.tien!.activeMatch!;
          state.turn = 0;
          state.opening = false;
          state.passed = [];
          state.pile = undefined;
          state.lastPlayer = undefined;
          if (rank === 1) {
            state.hands = [
              [0],
              [1],
              Array.from({ length: 13 }, (_, i) => i + 2),
              Array.from({ length: 13 }, (_, i) => i + 15),
            ];
            state.played = Array.from({ length: 24 }, (_, i) => i + 28);
            state.placements = [];
            state.winner = undefined;
          } else if (rank === 2) {
            state.hands = [
              [0],
              [],
              Array.from({ length: 13 }, (_, i) => i + 1),
              Array.from({ length: 13 }, (_, i) => i + 14),
            ];
            state.played = Array.from({ length: 25 }, (_, i) => i + 27);
            state.placements = [1];
            state.winner = 1;
          } else {
            state.hands = [
              Array.from({ length: 13 }, (_, i) => i),
              [],
              [51],
              Array.from({ length: 13 }, (_, i) => i + 13),
            ];
            state.played = Array.from({ length: 25 }, (_, i) => i + 26);
            state.placements = [1];
            state.winner = 1;
            state.pile = { kind: 'single', cards: [27], high: 27 };
            state.lastPlayer = 1;
          }
        });
        const input = {
          matchId: match.id,
          revision: match.revision,
          requestId: 'finish',
          action: rank === 3 ? { type: 'pass' as const } : { type: 'play' as const, cards: [0] },
        };
        const result = await sdk.playTien(input);
        const delta = roomId === 3 ? 0 : rank === 1 ? 140 : rank === 2 ? 60 : -100;
        if (rank === 1) {
          const first = result.steps.find((step) => step.match.placements?.length === 1);
          expect(first?.match.status).toBe('playing');
          expect(first?.match.session?.settled).not.toBe(true);
        }
        expect(result.match.status).toBe('finished');
        expect(result.match.placements).toHaveLength(2);
        expect(result.match.session).toMatchObject({ settled: true, coinDelta: delta });
        expect(result.match.session!.coinDeltas!.reduce((a, b) => a + b, 0)).toBe(0);
        expect((await sdk.getInventory()).farm.coins).toBe(1000 + delta);
        expect(await sdk.playTien(input)).toEqual(result);
        expect(
          await sdk.leaveArcadeTable({
            gameId: 'tien-len',
            matchId: match.id,
            revision: result.match.revision,
            requestId: 'leave-finished',
          }),
        ).toMatchObject({ coinDelta: 0, coins: 1000 + delta });
      });

for (const adapter of ['local', 'http'] as const)
  for (const playerCount of [2, 3] as const)
    for (const roomId of [0, 3])
      for (const rank of playerCount === 2 ? [1, 2] : [1, 2, 3])
        it(`${adapter}/${playerCount} seats/room ${roomId}: settles rank ${rank} and reserves only participating seats`, async () => {
          const context = pair(),
            sdk = context[adapter];
          const waiting = await prepare(sdk, 'tien-len', roomId, 100, playerCount);
          expect(waiting.session?.playerCount).toBe(playerCount);
          expect((await sdk.getTienLobby()).rooms[roomId].tables[0].occupants).toBe(playerCount);
          const { match } = await sdk.playTien({
            matchId: waiting.id,
            revision: waiting.revision,
            requestId: 'begin',
            action: { type: 'start' },
          });
          expect((await sdk.getInventory()).farm.coins).toBe(1000);
          await expect(
            sdk.configureArcadeTable({
              gameId: 'tien-len',
              matchId: match.id,
              revision: match.revision,
              requestId: 'change-count',
              stake: roomId === 3 ? 0 : 100,
              difficulty: 'hard',
              playerCount: 4,
            }),
          ).rejects.toMatchObject({ code: 'MATCH_IN_PROGRESS' });
          await context.repository.transaction((document) => {
            const state = document.tien!.activeMatch!;
            state.opening = false;
            state.turn = 0;
            state.passed = [];
            state.pile = undefined;
            state.lastPlayer = undefined;
            state.winner = undefined;
            state.placements = [];
            if (playerCount === 2) {
              if (rank === 1) {
                state.hands = [[0], [1], [], []];
                state.played = Array.from({ length: 24 }, (_, i) => i + 2);
                state.undealt = Array.from({ length: 26 }, (_, i) => i + 26);
              } else {
                state.hands = [[0], [51], [], []];
                state.played = Array.from({ length: 24 }, (_, i) => i + 1);
                state.undealt = Array.from({ length: 26 }, (_, i) => i + 25);
                state.pile = { kind: 'single', cards: [24], high: 24 };
                state.lastPlayer = 0;
              }
            } else if (rank === 1) {
              state.hands = [[0], [1], [2], []];
              state.played = Array.from({ length: 36 }, (_, i) => i + 3);
              state.undealt = Array.from({ length: 13 }, (_, i) => i + 39);
            } else {
              state.winner = 1;
              state.placements = [1];
              if (rank === 2) {
                state.hands = [[0], [], [1], []];
                state.played = Array.from({ length: 37 }, (_, i) => i + 2);
                state.undealt = Array.from({ length: 13 }, (_, i) => i + 39);
              } else {
                state.hands = [[0], [], [51], []];
                state.played = Array.from({ length: 37 }, (_, i) => i + 1);
                state.undealt = Array.from({ length: 13 }, (_, i) => i + 38);
                state.pile = { kind: 'single', cards: [37], high: 37 };
                state.lastPlayer = 1;
              }
            }
          });
          const input = {
            matchId: match.id,
            revision: match.revision,
            requestId: 'finish',
            action:
              rank === 3 || (playerCount === 2 && rank === 2)
                ? { type: 'pass' as const }
                : { type: 'play' as const, cards: [0] },
          };
          const result = await sdk.playTien(input);
          const delta =
            roomId === 3
              ? 0
              : playerCount === 2
                ? rank === 1
                  ? 100
                  : -100
                : rank === 1
                  ? 140
                  : rank === 2
                    ? -40
                    : -100;
          expect(result.match.status).toBe('finished');
          expect(result.match.session).toMatchObject({ settled: true, coinDelta: delta });
          expect(result.match.session!.coinDeltas!.slice(playerCount)).toEqual(Array(4 - playerCount).fill(0));
          expect(result.match.session!.coinDeltas!.reduce((a, b) => a + b, 0)).toBe(0);
          expect((await sdk.getInventory()).farm.coins).toBe(1000 + delta);
          expect(await sdk.playTien(input)).toEqual(result);
          expect(
            await sdk.leaveArcadeTable({
              gameId: 'tien-len',
              matchId: match.id,
              revision: result.match.revision,
              requestId: 'leave-finished',
            }),
          ).toMatchObject({ coins: 1000 + delta, coinDelta: 0 });
        });

for (const gameId of ['diamonds', 'tien-len'] as const)
  it(`${gameId}: resumes a legacy free game, releases it without charging and opens a configured practice table`, async () => {
    const { local, repository } = pair();
    await repository.transaction((document) => {
      if (gameId === 'diamonds') {
        document.arcade ??= { bestScore: 0, starts: {}, requests: {} };
        document.arcade.activeBattle = diamondsGame.create('legacy', 0, 42);
      } else {
        document.tien ??= { wins: 0, starts: {}, requests: {} };
        document.tien.activeMatch = tienLenGame.play(tienLenGame.create('legacy', 0, 42), { type: 'start' }).state;
      }
    });
    const match =
      gameId === 'diamonds' ? (await local.getArcadeLobby()).activeBattle! : (await local.getTienLobby()).activeMatch!;
    expect(match.id).toBe('legacy');
    expect(match.session).toBeUndefined();
    const input = { gameId, matchId: match.id, revision: match.revision, requestId: 'leave-legacy' };
    expect(await local.leaveArcadeTable(input)).toMatchObject({ coins: 1000, coinDelta: 0 });
    const fresh = await prepare(local, gameId, 3, 0);
    expect(fresh.session).toMatchObject({
      hostId: 'local-player',
      mode: 'practice',
      stake: 0,
      configured: true,
      difficulty: 'hard',
    });
    expect(await local.leaveArcadeTable(input)).toMatchObject({ coins: 1000, coinDelta: 0 });
    const current =
      gameId === 'diamonds' ? (await local.getArcadeLobby()).activeBattle! : (await local.getTienLobby()).activeMatch!;
    expect(current.id).toBe(fresh.id);
    expect(current.status).toBe('waiting');
  });
