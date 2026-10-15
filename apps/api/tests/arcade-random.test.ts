import { createGemBattle, isGemBattle } from '@chibi-town/arcade-games/gem-battle-logic';
import { createMiniMatch, isMiniMatch } from '@chibi-town/arcade-games/mini-games-logic';
import { createPhomMatch, isPhomMatch } from '@chibi-town/arcade-games/phom-logic';
import { isRandomSeed, type RandomSeed, random } from '@chibi-town/arcade-games/random';
import { createTienMatch, isTienMatch, playTienSeatAction } from '@chibi-town/arcade-games/tien-len-logic';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

it('uses all 128 bits of seeded state deterministically without mutating caller seeds', () => {
  const seed: RandomSeed = [12, 34, 56, 78];
  const first = createTienMatch('same', 0, seed);
  const second = createTienMatch('same', 0, seed);
  expect(playTienSeatAction(first, 0, { type: 'start' })).toEqual(playTienSeatAction(second, 0, { type: 'start' }));
  expect(first.seed).toEqual(seed);
  expect(createGemBattle('same', 0, seed)).toEqual(createGemBattle('same', 0, seed));

  const outputs = (s: RandomSeed) => {
    const state = { seed: s };
    return Array.from({ length: 16 }, () => random(state));
  };

  for (let word = 0; word < 4; word++) {
    const changed = [...seed] as [number, number, number, number];
    changed[word]++;
    expect(outputs(changed)).not.toEqual(outputs(seed));
  }
});

it('accepts numeric legacy saves and new tuple seeds in all match validators', () => {
  for (const seed of [42, [12, 34, 56, 78]] as RandomSeed[]) {
    const tien = createTienMatch('legacy', 0, seed);
    const phom = createPhomMatch('legacy', 0, seed);
    const mini = createMiniMatch('slots', 'legacy', 0, seed);
    const gem = createGemBattle('legacy', 0, seed);
    expect(isTienMatch({ ...tien, seed })).toBe(true);
    expect(isPhomMatch({ ...phom, seed })).toBe(true);
    expect(isMiniMatch({ ...mini, seed })).toBe(true);
    expect(isGemBattle({ ...gem, seed })).toBe(true);
  }
  for (const seed of [[1, 2, 3], [1, 2, 3, -1], [1, 2, 3, 2 ** 32], NaN]) expect(isRandomSeed(seed)).toBe(false);
});

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('stores 128-bit entropy and refreshes it before dealing', async () => {
  const host = await t.register('entropy');
  const sdk = t.sdkFor(host.cookie);
  const match = await sdk.startTienRoom({ roomId: 3, requestId: 'entropy' });

  const read = async () =>
    (await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, host.player.id)))[0].document.tien!
      .activeMatch!.seed;

  const waiting = await read();
  expect(Array.isArray(waiting) && waiting.length).toBe(4);
  await sdk.configureArcadeTable({
    gameId: 'tien-len',
    matchId: match.id,
    revision: match.revision,
    requestId: 'config',
    stake: 0,
    difficulty: 'medium',
  });
  const ready = (await sdk.getTienLobby()).activeMatch!;
  await sdk.playTien({ matchId: ready.id, revision: ready.revision, requestId: 'deal', action: { type: 'start' } });
  expect(await read()).not.toEqual(waiting);
});

it('keeps seeded engines deterministic and accepts legacy numeric saves', () => {
  const match = createTienMatch('same', 0, 42);
  expect(playTienSeatAction(match, 0, { type: 'start' })).toEqual(playTienSeatAction(match, 0, { type: 'start' }));
});
