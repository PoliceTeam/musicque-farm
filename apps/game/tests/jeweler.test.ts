import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { decodeJewelerSnapshot, type JewelerCommand } from '@chibi-town/contracts/jeweler';
import { JEWELER_MATERIALS } from '@chibi-town/game-content/jeweler';
import { describe, expect, it } from 'vitest';

function fixture(coins = 5_000_000) {
  const document = createLocalDocument();
  document.farm.coins = coins;
  const repository = createMemoryRepository(document);
  const sdk = createGameSdk({ adapter: 'local', repository });
  let sequence = 0;
  return {
    sdk,
    repository,

    execute: (type: JewelerCommand['type'], materialId: JewelerCommand['materialId'], count = 1) =>
      sdk.executeJeweler({ type, materialId, count, requestId: `test-${++sequence}` }),
  };
}

describe('jeweler economy', () => {
  it('uses every specified buy/sell price and preserves holdings on receipt replay', async () => {
    const t = fixture();
    let coins = 5_000_000;
    for (const m of JEWELER_MATERIALS) {
      const input = { type: 'buy' as const, materialId: m.id, count: 2, requestId: `buy-${m.id}` };
      const [first, replay] = await Promise.all([t.sdk.executeJeweler(input), t.sdk.executeJeweler(input)]);
      expect(first).toEqual(replay);
      coins -= m.buy * 2;
      expect(first.coins).toBe(coins);
      expect(first.materials[m.id]).toBe(2);
      await expect(t.sdk.executeJeweler({ ...input, type: 'sell' })).rejects.toMatchObject({
        code: 'REQUEST_CONFLICT',
      });
      const sold = await t.execute('sell', m.id, 2);
      coins += m.sell * 2;
      expect(sold.coins).toBe(coins);
      expect(sold.materials[m.id]).toBe(0);
      expect(decodeJewelerSnapshot(sold)).toEqual(sold);
    }
  });
  it('fuses precisely the provided recipes without an additional coin fee', async () => {
    const t = fixture();
    for (const m of JEWELER_MATERIALS) {
      if (!('recipe' in m)) continue;
      const before = await t.execute('buy', m.recipe.material, m.recipe.count * 2);
      const result = await t.execute('fuse', m.id, 2);
      expect(result.coins).toBe(before.coins);
      expect(result.materials[m.recipe.material]).toBe(before.materials[m.recipe.material] - m.recipe.count * 2);
      expect(result.materials[m.id]).toBe(before.materials[m.id] + 2);
    }
  });
  it('rejects overspending, selling absent materials, invalid amounts and consuming missing ingredients atomically', async () => {
    const t = fixture(5000);
    for (const input of [
      { type: 'buy', materialId: 'green', count: 1 },
      { type: 'sell', materialId: 'blue', count: 1 },
      { type: 'fuse', materialId: 'green', count: 1 },
      { type: 'buy', materialId: 'blue', count: -1 },
      { type: 'buy', materialId: 'blue', count: 1.5 },
      { type: 'buy', materialId: 'unknown', count: 1 },
      { type: 'fuse', materialId: 'blue', count: 1 },
    ])
      await expect(
        t.sdk.executeJeweler({ ...input, requestId: crypto.randomUUID() } as JewelerCommand),
      ).rejects.toBeDefined();
    expect((await t.sdk.getJeweler()).coins).toBe(5000);
    expect(Object.values((await t.sdk.getJeweler()).materials)).toEqual(Array(8).fill(0));
    await t.repository.transaction((document) => {
      document.tableStakes = { 'tien-len': 5000 };
    });
    await expect(t.execute('buy', 'blue')).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
    expect((await t.sdk.getJeweler()).availableCoins).toBe(0);
  });
  it('replays prototype-shaped request ids and prevents quantity/coin overflow', async () => {
    const t = fixture();
    const input = { type: 'buy' as const, materialId: 'blue' as const, count: 1, requestId: '__proto__' };
    const before = await t.sdk.executeJeweler(input);
    expect(await t.sdk.executeJeweler(input)).toEqual(before);
    await t.repository.transaction((document) => {
      document.farm.coins = Number.MAX_SAFE_INTEGER;
    });
    await expect(t.execute('sell', 'blue')).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    expect((await t.sdk.getJeweler()).materials.blue).toBe(1);
  });
});
