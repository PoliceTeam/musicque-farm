import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { expect, it } from 'vitest';

function setup() {
  const document = createLocalDocument();
  document.farm.coins = 1000;
  return createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(document),

    clock: () => 42,
  });
}

it('keeps chance rounds in the same table with new stakes and idempotent payouts', async () => {
  const sdk = setup();
  let m = await sdk.startMiniRoom({
    gameId: 'bau-cua',
    roomId: 0,
    tableId: 0,
    prepare: true,
    requestId: 'join-rounds',
  });
  for (let round = 0; round < 3; round++) {
    const settings = await sdk.configureArcadeTable({
      gameId: 'bau-cua',
      matchId: m.id,
      revision: m.revision,
      requestId: `ready-${round}`,
      stake: 100 + round * 10,
      choice: round,
      difficulty: 'medium',
    });
    expect(settings.session?.members?.every((member) => member.ready)).toBe(true);
    m = (await sdk.getMiniLobby('bau-cua')).activeMatch!;
    const input = {
      gameId: 'bau-cua' as const,
      matchId: m.id,
      revision: m.revision,
      requestId: `roll-${round}`,
      action: { type: 'roll' as const, symbol: round },
    };
    const result = await sdk.playMini(input);
    const coins = (await sdk.getInventory()).farm.coins;
    expect(await sdk.playMini(input)).toEqual(result);
    expect((await sdk.getInventory()).farm.coins).toBe(coins);
    expect(result.match.session?.settled).toBe(true);
    const next = await sdk.playMini({
      gameId: 'bau-cua',
      matchId: m.id,
      revision: result.match.revision,
      requestId: `next-${round}`,
      action: { type: 'next-round' },
    });
    m = next.match;
    expect(m.status).toBe('waiting');
    expect(m.session?.configured).toBe(false);
    expect(m.id).toBe('join-rounds');
    expect(m.roll).toBeUndefined();
    expect(m.choice).toBeUndefined();
    expect(m.multiplier).toBeUndefined();
    expect((await sdk.getInventory()).farm.coins).toBe(coins);
  }
});
it('blocks start until everyone is ready and lets a host kick ready or unready members', async () => {
  const sdk = setup();
  let m = await sdk.startTienRoom({ roomId: 0, tableId: 0, prepare: true, requestId: 'join-members' });

  const command = (action: { type: 'kick'; memberId: string } | { type: 'ready'; ready: boolean }, id: string) => ({
    gameId: 'tien-len' as const,
    matchId: m.id,
    revision: m.revision,
    requestId: id,
    action,
  });

  await sdk.updateArcadeMember(command({ type: 'kick', memberId: 'local-bot-3' }, 'kick-ready'));
  m = (await sdk.getTienLobby()).activeMatch!;
  expect(m.session?.members?.length).toBe(3);
  await sdk.configureArcadeTable({
    gameId: 'tien-len',
    matchId: m.id,
    revision: m.revision,
    requestId: 'ready-host',
    stake: 100,
    difficulty: 'medium',
  });
  m = (await sdk.getTienLobby()).activeMatch!;
  await sdk.updateArcadeMember(command({ type: 'ready', ready: false }, 'unready-host'));
  m = (await sdk.getTienLobby()).activeMatch!;
  await expect(
    sdk.playTien({ matchId: m.id, revision: m.revision, requestId: 'too-early', action: { type: 'start' } }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await expect(
    sdk.updateArcadeMember(command({ type: 'kick', memberId: 'local-player' }, 'kick-self')),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await sdk.updateArcadeMember(command({ type: 'ready', ready: true }, 'ready-again'));
  m = (await sdk.getTienLobby()).activeMatch!;
  const result = await sdk.playTien({
    matchId: m.id,
    revision: m.revision,
    requestId: 'start-members',
    action: { type: 'start' },
  });
  expect(result.match.session?.playerCount).toBe(3);
  await expect(
    sdk.updateArcadeMember({
      ...command({ type: 'kick', memberId: 'local-bot-2' }, 'kick-playing'),
      revision: result.match.revision,
    }),
  ).rejects.toMatchObject({ code: 'MATCH_IN_PROGRESS' });
});
it('cannot start a table after kicking the last opponent', async () => {
  const sdk = setup();
  let m = await sdk.startMiniRoom({ gameId: 'slots', roomId: 0, prepare: true, requestId: 'join-slots' });
  await sdk.configureArcadeTable({
    gameId: 'slots',
    matchId: m.id,
    revision: m.revision,
    requestId: 'slots-ready',
    stake: 100,
    difficulty: 'medium',
  });
  m = (await sdk.getMiniLobby('slots')).activeMatch!;
  await sdk.updateArcadeMember({
    gameId: 'slots',
    matchId: m.id,
    revision: m.revision,
    requestId: 'kick-last',
    action: { type: 'kick', memberId: 'local-bot-1' },
  });
  m = (await sdk.getMiniLobby('slots')).activeMatch!;
  for (const memberId of ['local-bot-2', 'local-bot-3']) {
    await sdk.updateArcadeMember({
      gameId: 'slots',
      matchId: m.id,
      revision: m.revision,
      requestId: `kick-${memberId}`,
      action: { type: 'kick', memberId },
    });
    m = (await sdk.getMiniLobby('slots')).activeMatch!;
  }
  await expect(
    sdk.playMini({
      gameId: 'slots',
      matchId: m.id,
      revision: m.revision,
      requestId: 'roll-alone',
      action: { type: 'spin' },
    }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
});

it('can kick an unready member and preserves the selected Bầu cua door on reload', async () => {
  const repository = createMemoryRepository(createLocalDocument());
  const sdk = createGameSdk({ adapter: 'local', repository });
  let m = await sdk.startMiniRoom({ gameId: 'bau-cua', roomId: 3, prepare: true, requestId: 'join-unready' });
  await repository.transaction((document) => {
    document.mini!['bau-cua']!.activeMatch!.session!.members = [
      { id: 'local-player', ready: false },
      { id: 'local-bot-1', ready: false },
    ];
  });
  const kick = {
    gameId: 'bau-cua' as const,
    matchId: m.id,
    revision: m.revision,
    requestId: 'kick-unready',
    action: { type: 'kick' as const, memberId: 'local-bot-1' },
  };
  const result = await sdk.updateArcadeMember(kick);
  expect(result.session?.members).toHaveLength(1);
  expect(await sdk.updateArcadeMember(kick)).toEqual(result);
  m = (await sdk.getMiniLobby('bau-cua')).activeMatch!;
  await sdk.configureArcadeTable({
    gameId: 'bau-cua',
    matchId: m.id,
    revision: m.revision,
    requestId: 'choice-ready',
    stake: 0,
    difficulty: 'medium',
    choice: 4,
  });
  expect((await sdk.getMiniLobby('bau-cua')).activeMatch?.choice).toBe(4);
});

it('settles every Bầu cua member once in the same transaction, using separate doors and stakes', async () => {
  const repository = createMemoryRepository(createLocalDocument());
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    clock: () => 42,
  });
  let m = await sdk.startMiniRoom({ gameId: 'bau-cua', roomId: 0, prepare: true, requestId: 'four-bets' });
  expect((await sdk.getMiniLobby('bau-cua')).rooms[0].tables[0].capacity).toBe(4);
  await sdk.configureArcadeTable({
    gameId: 'bau-cua',
    matchId: m.id,
    revision: m.revision,
    requestId: 'four-ready',
    stake: 100,
    difficulty: 'medium',
    choice: 0,
    bets: [
      { memberId: 'local-bot-1', stake: 50, choice: 1 },
      { memberId: 'local-bot-2', stake: 200, choice: 2 },
      { memberId: 'local-bot-3', stake: 300, choice: 3 },
    ],
  });
  m = (await sdk.getMiniLobby('bau-cua')).activeMatch!;
  const balances = await repository.transaction((document) => ({
    host: document.farm.coins,
    bots: { ...document.arcadeBotCoins },
  }));
  const input = {
    gameId: 'bau-cua' as const,
    matchId: m.id,
    revision: m.revision,
    requestId: 'four-roll',
    action: { type: 'roll' as const, symbol: 0 },
  };
  const result = await sdk.playMini(input);
  const payouts = result.match.session!.housePayouts!;
  expect(payouts).toHaveLength(4);
  for (const [index, payout] of payouts.entries()) {
    const hits = result.match.roll!.filter((symbol) => symbol === index).length;
    const stake = [100, 50, 200, 300][index];
    expect(payout.delta).toBe(stake * (hits || -1));
    const before = index === 0 ? balances.host : balances.bots[payout.memberId];
    expect(payout.coinsAfter).toBe(before + payout.delta);
  }
  expect(result.match.session!.coinDeltas).toBeUndefined();
  expect(await sdk.playMini(input)).toEqual(result);
  const after = await repository.transaction((document) => ({
    host: document.farm.coins,
    bots: document.arcadeBotCoins,
  }));
  expect(after.host).toBe(payouts[0].coinsAfter);
  for (const p of payouts.slice(1)) expect(after.bots![p.memberId]).toBe(p.coinsAfter);
});

it('sits out an insolvent bot and commits the other settlements atomically', async () => {
  const repository = createMemoryRepository(createLocalDocument());
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    random: () => 0.5,
  });
  const m = await sdk.startMiniRoom({ gameId: 'bau-cua', roomId: 0, requestId: 'atomic-bets' });
  await sdk.configureArcadeTable({
    gameId: 'bau-cua',
    matchId: m.id,
    revision: 0,
    requestId: 'atomic-ready',
    stake: 100,
    difficulty: 'medium',
    choice: 0,
    bets: [{ memberId: 'local-bot-1', stake: 50, choice: 5 }],
  });
  await repository.transaction((document) => {
    document.arcadeBotCoins!['local-bot-1'] = 0;
  });
  const command = {
    gameId: 'bau-cua' as const,
    matchId: m.id,
    revision: 1,
    requestId: 'atomic-roll',
    action: { type: 'roll' as const, symbol: 0 },
  };
  const beforeCoins = await repository.transaction((document) => document.farm.coins);
  const result = await sdk.playMini(command);
  expect(result.match.session!.members!.find((member) => member.id === 'local-bot-1')!.stake).toBe(0);
  expect(result.match.session!.housePayouts).toContainEqual({ memberId: 'local-bot-1', delta: 0, coinsAfter: 0 });
  const after = await repository.transaction((document) => structuredClone(document));
  expect(after.farm.coins).toBe(beforeCoins + result.match.session!.coinDelta!);
  expect(await sdk.playMini(command)).toEqual(result);
  expect(await repository.transaction((document) => structuredClone(document))).toEqual(after);
});

it('does not let the host ready action override an unready member', async () => {
  const sdk = setup();
  let m = await sdk.startTienRoom({ roomId: 0, prepare: true, requestId: 'all-ready-gate' });
  await sdk.updateArcadeMember({
    gameId: 'tien-len',
    matchId: m.id,
    revision: m.revision,
    requestId: 'unready-bot',
    action: { type: 'ready', memberId: 'local-bot-2', ready: false },
  });
  m = (await sdk.getTienLobby()).activeMatch!;
  await sdk.configureArcadeTable({
    gameId: 'tien-len',
    matchId: m.id,
    revision: m.revision,
    requestId: 'ready-owner',
    stake: 100,
    difficulty: 'medium',
  });
  m = (await sdk.getTienLobby()).activeMatch!;
  expect(m.session?.members?.find((member) => member.id === 'local-bot-2')?.ready).toBe(false);
  await expect(
    sdk.playTien({
      matchId: m.id,
      revision: m.revision,
      requestId: 'owner-cannot-force-start',
      action: { type: 'start' },
    }),
  ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await sdk.updateArcadeMember({
    gameId: 'tien-len',
    matchId: m.id,
    revision: m.revision,
    requestId: 'kick-unready-member',
    action: { type: 'kick', memberId: 'local-bot-2' },
  });
  m = (await sdk.getTienLobby()).activeMatch!;
  const result = await sdk.playTien({
    matchId: m.id,
    revision: m.revision,
    requestId: 'everyone-left-ready',
    action: { type: 'start' },
  });
  expect(result.match.session?.playerCount).toBe(3);
});
