import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { COSMETIC_CATALOG } from '@chibi-town/character-core/cosmetic-catalog';
import { decodeCommandResult } from '@chibi-town/contracts';
import { decodeCharacterInventoryPage } from '@chibi-town/contracts/character-inventory';
import { cosmeticUpgradeRecipe, UPGRADE_GROUPS } from '@chibi-town/game-content/cosmetic-upgrades';
import { ensureCharacterInventory, grantCharacterCosmetics } from '@chibi-town/game-service';
import { describe, expect, it } from 'vitest';

async function fixture(level = 1, random = () => 0.99999) {
  const doc = createLocalDocument();
  doc.farm.coins = 100_000_000;
  doc.farm.gems = 100_000;
  doc.jeweler = {
    materials: {
      blue: 1000,
      green: 1000,
      purple: 1000,
      pink: 1000,
      gold: 1000,
      mystic: 1000,
      stellar: 1000,
      celestial: 1000,
    },
    receipts: {},
  };
  const repository = createMemoryRepository(doc);
  await repository.transaction((document) => {
    const state = ensureCharacterInventory(document, 1000);
    grantCharacterCosmetics(
      state,
      'fixture',
      [`item/wings.angel.${level}`],
      { kind: 'event', eventId: 'test', rewardId: 'test' },
      1000,
    );
  });
  const sdk = createGameSdk({
    adapter: 'local',
    repository,
    random,

    clock: () => 1000,
  });
  const row = (await sdk.getCharacterInventory({ view: 'upgrades' })).rows.find(
    (row) => row.definition.groupId === 'item/wings.angel',
  )!;
  const input = {
    type: 'upgrade-character-item' as const,
    instanceId: row.instance!.instanceId,
    targetId: row.upgrade!.target!.id,
    currency: 'coins' as 'coins' | 'gems',
    recipeVersion: 1,
    mapInstanceId: 'home',
    requestId: 'try',
  };
  return { repository, sdk, row, input };
}

describe('mandatory-material upgrades and success rates', () => {
  it.each([1, 2, 3, 4, 5])(
    'uses exact rate boundaries for source level %i and adds ten percentage points for lượng',
    async (level) => {
      const chance = [85, 75, 55, 35, 25][level - 1];
      for (const currency of ['coins', 'gems'] as const) {
        const actual = chance + (currency === 'gems' ? 10 : 0);
        for (const [roll, success] of [
          [actual / 100 - 0.000001, true],
          [actual / 100, false],
        ] as const) {
          const t = await fixture(level, () => roll);
          const result = await t.sdk.execute({ ...t.input, currency });
          expect(result.upgrade).toMatchObject({ success, chance: actual, guaranteed: false });
          expect(decodeCommandResult(result)).toEqual(result);
          expect(result.farm.coins).toBe(100_000_000 - (currency === 'coins' ? t.row.upgrade!.price.amount : 0));
          expect(result.farm.gems).toBe(100_000 - (currency === 'gems' ? t.row.upgrade!.gemPrice! : 0));
          const materials = (await t.sdk.getJeweler()).materials;
          for (const m of t.row.upgrade!.materials) expect(materials[m.materialId]).toBe(1000 - m.count);
        }
      }
    },
  );
  it.each([
    [2, 5],
    [3, 10],
    [4, 15],
  ])(
    'guarantees %i -> next on the %ith attempt and shares progress across currencies and reloads',
    async (level, max) => {
      const t = await fixture(level);
      for (let n = 1; n <= max; n++) {
        const result = await t.sdk.execute({
          ...t.input,
          currency: n % 2 ? 'coins' : 'gems',
          requestId: `attempt-${n}`,
        });
        expect(result.upgrade).toMatchObject({
          success: n === max,
          guaranteed: n === max,
          failuresBefore: n - 1,
          failuresAfter: n === max ? 0 : n,
        });
        if (n < max) {
          const reloaded = createGameSdk({ adapter: 'local', repository: t.repository });
          const page = await reloaded.getCharacterInventory({ view: 'upgrades' });
          expect(page.rows.find((row) => row.definition.groupId === 'item/wings.angel')!.upgrade!.failures).toBe(n);
          expect(decodeCharacterInventoryPage(page)).toEqual(page);
        }
      }
      expect((await t.sdk.getJeweler()).materials[t.row.upgrade!.materials[0].materialId]).toBe(1000 - max);
      expect(await t.repository.transaction((doc) => doc.upgradeFailures)).toEqual({});
    },
  );
  it.each([1, 5])('does not guarantee source level %i even after fifty failures', async (level) => {
    const t = await fixture(level);
    for (let n = 1; n <= 50; n++)
      expect((await t.sdk.execute({ ...t.input, requestId: `attempt-${n}` })).upgrade).toMatchObject({
        success: false,
        guaranteed: false,
        guaranteeAt: null,
        failuresAfter: n,
      });
  });
  it('persists failure receipts, never rerolls on replay and leaves inventory/outfit unchanged on failure', async () => {
    let calls = 0;
    const t = await fixture(2, () => {
      calls++;
      return 0.99;
    });
    const before = await t.repository.transaction((doc) => ({ inventory: doc.characterInventory, outfit: doc.outfit }));
    const [first, replay] = await Promise.all([t.sdk.execute(t.input), t.sdk.execute(t.input)]);
    expect(first).toEqual(replay);
    expect(calls).toBe(1);
    expect(first.upgrade).toMatchObject({ success: false, failuresAfter: 1 });
    expect(
      await t.repository.transaction((doc) => ({ inventory: doc.characterInventory, outfit: doc.outfit })),
    ).toEqual(before);
    await expect(t.sdk.execute({ ...t.input, currency: 'gems' })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
    await t.repository.transaction((doc) => {
      doc.farm.gems = 7;
    });
    expect((await t.sdk.execute(t.input)).upgrade).toEqual(first.upgrade);
    expect(calls).toBe(1);
  });
  it('rejects missing materials, unsupported currency, stale recipes, missing currency/version and insufficient lượng without consuming anything', async () => {
    const t = await fixture();
    await t.repository.transaction((doc) => {
      doc.jeweler!.materials.blue = 0;
    });
    const before = await t.repository.transaction((doc) => doc);
    await expect(t.sdk.execute(t.input)).rejects.toMatchObject({ code: 'NOT_ENOUGH_MATERIALS' });
    expect(await t.repository.transaction((doc) => doc)).toEqual(before);
    await expect(t.sdk.execute({ ...t.input, recipeVersion: 99 })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    await expect(t.sdk.execute({ ...t.input, currency: undefined } as never)).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
    await expect(t.sdk.execute({ ...t.input, recipeVersion: undefined } as never)).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
    });
    await t.repository.transaction((doc) => {
      doc.farm.gems = 0;
    });
    await expect(t.sdk.execute({ ...t.input, currency: 'gems' })).rejects.toMatchObject({ code: 'INSUFFICIENT_GEMS' });
    expect(await t.repository.transaction((doc) => doc.upgradeFailures)).toBeUndefined();
    expect(cosmeticUpgradeRecipe('item/hair.goku', 2)?.gems).toBeNull();
  });
  it('rolls back invalid random output and does not consume materials or a pity attempt', async () => {
    const t = await fixture(2, () => NaN);
    const before = await t.repository.transaction((doc) => doc);
    await expect(t.sdk.execute(t.input)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    expect(await t.repository.transaction((doc) => doc)).toEqual(before);
  });
  it('allows exactly the 28 configured families and only real consecutive levels, retaining reward exclusivity', () => {
    expect(Object.keys(UPGRADE_GROUPS)).toHaveLength(28);
    for (const [groupId, config] of Object.entries(UPGRADE_GROUPS)) {
      const levels = Object.values(COSMETIC_CATALOG).filter(
        (d) => d.groupId === groupId && (d.kind === 'item' || d.kind === 'pet'),
      );
      for (let level = 2; level <= config.max; level++) {
        expect(levels.some((d) => 'level' in d && d.level === level)).toBe(true);
        expect(cosmeticUpgradeRecipe(groupId, level)).toBeDefined();
      }
      expect(cosmeticUpgradeRecipe(groupId, config.max + 1)).toBeUndefined();
    }
    expect(cosmeticUpgradeRecipe('item/wings.pixie', 2)).toBeUndefined();
  });
});
