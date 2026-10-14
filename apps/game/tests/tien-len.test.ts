import 'fake-indexeddb/auto';
import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
} from '@chibi-town/api-sdk';
import {
  beatsTien,
  createTienMatch,
  isTienMatch,
  isTienSnapshot,
  legalTienPlays,
  playTienAction,
  tienCombo,
  tienSnapshot,
} from '@chibi-town/arcade-games/tien-len-logic';
import { decodeTienLobby, decodeTienSnapshot } from '@chibi-town/contracts/tien-len';
import { describe, expect, it } from 'vitest';

describe('Tiến lên rules', () => {
  for (const playerCount of [2, 3] as const)
    it(`plays ${playerCount}-seat games, keeps undealt cards secret and opens with the smallest dealt card`, () => {
      for (let seed = 0; seed < 12; seed++) {
        const initial = createTienMatch('short-table', 3, seed);
        initial.session = {
          hostId: 'local-player',
          mode: 'practice',
          stake: 0,
          difficulty: 'hard',
          payoutRule: 'ranked-pool',
          playerCount,
        };
        const started = playTienAction(initial, { type: 'start' });
        expect(started.result.steps[0].match.counts.filter((count) => count === 13)).toHaveLength(playerCount);
        expect(started.result.match.undealtCount).toBe((4 - playerCount) * 13);
        expect('undealt' in started.result.match).toBe(false);
        const first = started.result.steps.find((step) => step.action === 'play');
        if (first) expect(first.cards).toContain(started.state.openingCard);
        let state = started.state;
        let commands = 0;
        while (state.status === 'playing' && commands++ < 100) {
          const moves = legalTienPlays(state.hands[0], state.pile, state.opening, state.openingCard);
          const next = playTienAction(state, moves[0] ? { type: 'play', cards: moves[0].cards } : { type: 'pass' });
          expect(next.result.steps.every((step) => step.actor < playerCount && isTienSnapshot(step.match))).toBe(true);
          expect(isTienMatch(next.state)).toBe(true);
          state = next.state;
        }
        expect(state.status).toBe('finished');
        expect(state.placements).toHaveLength(2);
        expect(state.hands.flat().length + state.played.length + state.undealt!.length).toBe(52);
        expect(state.hands.slice(playerCount).every((hand) => hand.length === 0)).toBe(true);
        if (playerCount === 2) expect(state.hands[state.placements![1]].length).toBeGreaterThan(0);
      }
    });
  it('continues after first place, skips finished seats and completes top-two games deterministically', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const)
      for (let seed = 0; seed < 16; seed++) {
        let state = createTienMatch('top-two', 3, seed);
        state.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty, payoutRule: 'top-two-60-40' };
        state = playTienAction(state, { type: 'start' }).state;
        let commands = 0;
        while (state.status === 'playing' && commands++ < 150) {
          expect(state.turn).toBe(0);
          expect(state.hands[0].length).toBeGreaterThan(0);
          const moves = legalTienPlays(state.hands[0], state.pile, state.opening);
          const action = moves[0] ? { type: 'play' as const, cards: moves[0].cards } : { type: 'pass' as const };
          const before = JSON.stringify(state);
          const result = playTienAction(state, action);
          expect(JSON.stringify(state)).toBe(before);
          expect(result).toEqual(playTienAction(state, action));
          expect(isTienMatch(result.state)).toBe(true);
          expect(result.result.steps.every((step) => isTienSnapshot(step.match))).toBe(true);
          state = result.state;
        }
        expect(state.status).toBe('finished');
        expect(state.placements).toHaveLength(2);
        expect(state.winner).toBe(state.placements![0]);
        expect(new Set(state.placements).size).toBe(2);
      }
  });
  it('orders ranks and suits, excludes 2 from runs and recognizes consecutive pairs', () => {
    expect(tienCombo([0, 4, 8])?.kind).toBe('straight');
    expect(tienCombo([40, 44, 48])).toBeUndefined();
    expect(tienCombo([0, 1, 4, 5, 8, 9])?.kind).toBe('pairs3');
    expect(tienCombo([0, 1, 4, 5, 8, 9, 12, 13])?.kind).toBe('pairs4');
    expect(tienCombo([0, 0])).toBeUndefined();
    expect(beatsTien(tienCombo([3])!, tienCombo([2]))).toBe(true);
    expect(beatsTien(tienCombo([0, 4, 8, 12])!, tienCombo([0, 4, 8]))).toBe(false);
  });
  it('allows the documented chops', () => {
    const triplePairs = tienCombo([0, 1, 4, 5, 8, 9])!,
      quad = tienCombo([12, 13, 14, 15])!,
      fourPairs = tienCombo([0, 1, 4, 5, 8, 9, 12, 13])!;
    expect(beatsTien(triplePairs, tienCombo([51]))).toBe(true);
    expect(beatsTien(triplePairs, tienCombo([50, 51]))).toBe(false);
    expect(beatsTien(quad, tienCombo([50, 51]))).toBe(true);
    expect(beatsTien(quad, triplePairs)).toBe(true);
    expect(beatsTien(fourPairs, quad)).toBe(true);
  });
  it('deals all 52 cards once and hides bot hands from snapshots', () => {
    const started = playTienAction(createTienMatch('table', 0, 42), { type: 'start' });
    expect(isTienMatch(started.state)).toBe(true);
    expect(isTienSnapshot(started.result.match)).toBe(true);
    expect(started.state.hands.flat().length + started.state.played.length).toBe(52);
    expect(new Set([...started.state.hands.flat(), ...started.state.played]).size).toBe(52);
    expect('hands' in started.result.match).toBe(false);
    const first = started.result.steps.find((step) => step.action === 'play');
    if (first) expect(first.cards).toContain(0);
  });
  it('completes many deterministic bot games, preserving cards and enforcing passes', () => {
    for (let seed = 0; seed < 12; seed++) {
      let state = playTienAction(createTienMatch('table', 0, seed), { type: 'start' }).state;
      let commands = 0;
      while (state.status === 'playing' && commands++ < 100) {
        expect(state.turn).toBe(0);
        const moves = legalTienPlays(state.hands[0], state.pile, state.opening);
        const action = moves[0] ? { type: 'play' as const, cards: moves[0].cards } : { type: 'pass' as const };
        const result = playTienAction(state, action);
        expect(result).toEqual(playTienAction(state, action));
        expect(isTienMatch(result.state)).toBe(true);
        state = result.state;
      }
      expect(state.status).toBe('finished');
      expect(state.hands[state.winner!]).toHaveLength(0);
    }
  });
});

function pair() {
  const repository = createMemoryRepository();
  const local = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  const http = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://tien.test',

    fetch: async (url, init) => {
      try {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        return Response.json(
          String(url).endsWith('/configure')
            ? await local.configureArcadeTable(body)
            : String(url).endsWith('/start')
              ? await local.startTienRoom(body)
              : String(url).endsWith('/play')
                ? await local.playTien(body)
                : await local.getTienLobby(),
        );
      } catch (error) {
        return Response.json({ code: (error as { code: string }).code }, { status: 409 });
      }
    },
  });
  return { local, http, repository };
}

async function configureTien(sdk: ReturnType<typeof createGameSdk>, match: { id: string; revision: number }) {
  await sdk.configureArcadeTable({
    gameId: 'tien-len',
    matchId: match.id,
    revision: match.revision,
    stake: 100,
    difficulty: 'medium',
    requestId: `configure-${match.id}`,
  });
}

for (const adapter of ['local', 'http'] as const)
  it(`${adapter}: starts and replays turns once, resumes, rejects stale commands and preserves farm`, async () => {
    const adapters = pair(),
      sdk = adapters[adapter],
      before = await adapters.local.getInventory();
    const match = await sdk.startTienRoom({ roomId: 0, requestId: 'table' });
    expect(match.status).toBe('waiting');
    await configureTien(sdk, match);
    const command = {
      requestId: 'deal',
      matchId: match.id,
      revision: match.revision + 1,
      action: { type: 'start' as const },
    };
    const started = await sdk.playTien(command);
    expect(await sdk.playTien(command)).toEqual(started);
    expect(await sdk.startTienRoom({ roomId: 0, requestId: 'resume' })).toEqual(started.match);
    await expect(sdk.playTien({ ...command, requestId: 'stale' })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
    await expect(sdk.startTienRoom({ roomId: 1, requestId: 'other' })).rejects.toMatchObject({
      code: 'MATCH_IN_PROGRESS',
    });
    expect((await adapters.local.getInventory()).farm).toEqual(before.farm);
    expect('hands' in started.match).toBe(false);
  });
it('keeps an active table across IndexedDB reload', async () => {
  const name = `tien-test-${crypto.randomUUID()}`;
  const sdk = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  const match = await sdk.startTienRoom({ roomId: 0, requestId: 'table' });
  await configureTien(sdk, match);
  const result = await sdk.playTien({ requestId: 'deal', matchId: match.id, revision: 1, action: { type: 'start' } });
  const next = createGameSdk({ adapter: 'local', repository: createBrowserRepository({ name }) });
  expect((await next.getTienLobby()).activeMatch).toEqual(result.match);
  expect(tienSnapshot(createTienMatch('new', 1, 1)).status).toBe('waiting');
});

it('rejects malformed cards, piles and room entries without crashing validators', () => {
  const waiting = tienSnapshot(createTienMatch('table', 0, 42));
  expect(tienCombo(null as never)).toBeUndefined();
  for (const pile of [null, {}, { cards: null }, { cards: 'invalid' }]) {
    expect(isTienSnapshot({ ...waiting, pile })).toBe(false);
    expect(() => decodeTienSnapshot({ ...waiting, pile })).toThrow('Invalid card table');
  }
  expect(() => decodeTienLobby({ source: 'local', wins: 0, rooms: Array(4).fill(null) })).toThrow('Invalid card lobby');
  const started = playTienAction(createTienMatch('table', 0, 42), { type: 'start' }).state;
  const corrupted = structuredClone(started);
  corrupted.hands[1][0] = 52;
  expect(isTienMatch(corrupted)).toBe(false);
});
it('discards corrupt saved tables and replay records while preserving farm progress', async () => {
  const initial = createLocalDocument();
  const farm = structuredClone(initial.farm);
  initial.tien = {
    wins: 2,
    activeMatch: { ...createTienMatch('table', 0, 42), pile: null } as never,
    starts: {
      damaged: { fingerprint: '{}', match: null } as never,
    },
    requests: {
      damaged: { fingerprint: '{}', result: null } as never,
    },
  };
  const repository = createMemoryRepository(initial);
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  expect((await sdk.getTienLobby()).activeMatch).toBeUndefined();
  expect((await sdk.getTienLobby()).wins).toBe(2);
  expect(await repository.transaction((document) => document.farm)).toEqual(farm);
  const match = await sdk.startTienRoom({ roomId: 0, requestId: 'damaged' });
  await configureTien(sdk, match);
  const result = await sdk.playTien({
    requestId: 'damaged',
    matchId: match.id,
    revision: match.revision + 1,
    action: { type: 'start' },
  });
  expect(isTienSnapshot(result.match)).toBe(true);
});

it('assigns Tiến lên seats to a fixed room and table and frees them after finishing', async () => {
  const { local, repository } = pair();
  const before = await local.getTienLobby();
  expect(before.rooms).toHaveLength(4);
  expect(
    before.rooms.every(
      (room) => room.tables.length === (room.id === 3 ? 20 : 10) && room.tables.every((table) => table.occupants === 0),
    ),
  ).toBe(true);
  const match = await local.startTienRoom({ roomId: 1, tableId: 6, requestId: 'seat' });
  expect(match).toMatchObject({ roomId: 1, tableId: 6, status: 'waiting' });
  expect((await local.getTienLobby()).rooms[1].tables[6]).toMatchObject({
    occupants: 4,
    capacity: 4,
    status: 'waiting',
  });
  await expect(local.startTienRoom({ roomId: 1, tableId: 5, requestId: 'other-seat' })).rejects.toMatchObject({
    code: 'MATCH_IN_PROGRESS',
  });
  await repository.transaction((document) => {
    delete document.tien!.activeMatch;
  });
  expect((await local.getTienLobby()).rooms[1].tables[6].occupants).toBe(0);
});
