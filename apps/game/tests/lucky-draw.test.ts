import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { LUCKY_DRAW_ID, LUCKY_PRIZES } from '@chibi-town/game-content/lucky-draw';
import { describe, expect, it } from 'vitest';
import { nextWheelRotation } from '@/features/lucky-draw/_utils/wheel-logic';

function fixture(random = 0.99, coins = 500_000) {
  const document = createLocalDocument();
  document.farm.coins = coins;
  const repository = createMemoryRepository(document);
  const sdk = createGameSdk({
    adapter: 'local',
    repository,

    random: () => random,

    clock: () => 1000,
  });
  return { sdk, repository };
}

const spin = (requestId: string) => ({ type: 'spin' as const, drawId: LUCKY_DRAW_ID, requestId });

describe('lucky draw transactions', () => {
  it('buys at the server price once, persists tickets and rejects conflicting retries', async () => {
    const { sdk, repository } = fixture();
    const buy = { type: 'buy-tickets' as const, count: 5, requestId: 'buy' };
    await Promise.all([sdk.executeLuckyDraw(buy), sdk.executeLuckyDraw(buy)]);
    expect(await sdk.getLuckyDraw()).toMatchObject({ tickets: 5, coins: 425_000 });
    const reopened = createGameSdk({ adapter: 'local', repository });
    expect((await reopened.getLuckyDraw()).tickets).toBe(5);
    await expect(sdk.executeLuckyDraw({ ...buy, count: 10 })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
    await expect(sdk.executeLuckyDraw(spin('buy'))).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
  });
  it('rejects invalid counts, missing tickets, unknown pools and spending reserved coins without mutations', async () => {
    const { sdk, repository } = fixture();
    for (const count of [0, -1, 1.5, 101, Number.NaN])
      await expect(sdk.executeLuckyDraw({ type: 'buy-tickets', count, requestId: 'invalid' })).rejects.toMatchObject({
        code: 'INVALID_COMMAND',
      });
    await expect(sdk.executeLuckyDraw(spin('empty'))).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await expect(sdk.executeLuckyDraw({ ...spin('wrong'), drawId: 'forged' })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
    await repository.transaction((document) => {
      document.tableStakes = { 'tien-len': 499_999 };
    });
    await expect(sdk.executeLuckyDraw({ type: 'buy-tickets', count: 1, requestId: 'reserved' })).rejects.toMatchObject({
      code: 'INSUFFICIENT_COINS',
    });
    expect((await sdk.getLuckyDraw()).coins).toBe(500_000);
  });
  it('grants exclusive wings once, rejects direct purchases, allows equipping and compensates duplicates', async () => {
    const { sdk } = fixture();
    await expect(
      sdk.execute({
        type: 'buy-cosmetic',
        offerId: 'item/wings.pixie',
        requestId: 'forged-shop',
        mapInstanceId: 'home',
      }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect(
      (await sdk.getCharacterInventory({ view: 'shop', slot: 'back', limit: 50 })).rows.some(
        (row) => row.definition.id === 'item/wings.pixie',
      ),
    ).toBe(false);
    await sdk.executeLuckyDraw({ type: 'buy-tickets', count: 2, requestId: 'buy' });
    const first = await sdk.executeLuckyDraw(spin('first'));
    expect(first).toMatchObject({
      tickets: 1,
      result: { prizeId: 'pixie-wings', duplicate: false },
      ownedCosmetics: ['item/wings.pixie'],
    });
    const replay = await sdk.executeLuckyDraw(spin('first'));
    expect(replay).toEqual(first);
    const bag = await sdk.getCharacterInventory({ view: 'bag' });
    const wings = bag.rows.find((row) => row.definition.id === 'item/wings.pixie')!;
    await sdk.execute({
      type: 'equip-character-item',
      instanceId: wings.instance!.instanceId,
      requestId: 'equip-wings',
      mapInstanceId: 'home',
    });
    expect((await sdk.getLuckyDraw()).outfit.back).toBe('wings.pixie');
    expect(await sdk.executeLuckyDraw(spin('duplicate'))).toMatchObject({
      tickets: 0,
      coins: 500_000,
      result: { duplicate: true },
    });
    expect(
      (await sdk.getCharacterInventory({ view: 'owned', slot: 'back' })).rows.filter(
        (row) => row.definition.id === 'item/wings.pixie',
      ),
    ).toHaveLength(1);
  });
  it('falls back to the warehouse when the bag is full', async () => {
    const { sdk, repository } = fixture();
    await sdk.getLuckyDraw();
    await repository.transaction((document) => {
      document.characterInventory!.bagSlots = 0;
    });
    await sdk.executeLuckyDraw({ type: 'buy-tickets', count: 1, requestId: 'buy' });
    await sdk.executeLuckyDraw(spin('reward'));
    expect(
      (await sdk.getCharacterInventory({ view: 'warehouse' })).rows.some(
        (row) => row.definition.id === 'item/wings.pixie',
      ),
    ).toBe(true);
  });
  it('covers every weighted interval and aligns the rendered winning sector with the pointer', async () => {
    let start = 0;
    for (const [index, prize] of LUCKY_PRIZES.entries()) {
      const { sdk } = fixture((start + prize.weight / 2) / 100);
      await sdk.executeLuckyDraw({ type: 'buy-tickets', count: 1, requestId: 'buy' });
      const result = await sdk.executeLuckyDraw(spin('roll'));
      expect(result.result!.prizeId).toBe(prize.id);
      const angle = nextWheelRotation(739, index, LUCKY_PRIZES.length);
      expect(angle).toBeGreaterThan(739 + 2160 - 1);
      expect((angle + (index + 0.5) * 45) % 360).toBeCloseTo(0);
      start += prize.weight;
    }
    expect(start).toBe(100);
  });
  it('supports prototype-shaped receipt IDs without rerolling or mutating object prototypes', async () => {
    const { sdk } = fixture(0);
    const buy = { type: 'buy-tickets' as const, count: 1, requestId: '__proto__' };
    await sdk.executeLuckyDraw(buy);
    await sdk.executeLuckyDraw(buy);
    expect((await sdk.getLuckyDraw()).tickets).toBe(1);
    await sdk.executeLuckyDraw(spin('constructor'));
    await sdk.executeLuckyDraw(spin('constructor'));
    expect((await sdk.getLuckyDraw()).tickets).toBe(0);
    expect(defaultOutfit.back).not.toBe('wings.pixie');
  });
});
