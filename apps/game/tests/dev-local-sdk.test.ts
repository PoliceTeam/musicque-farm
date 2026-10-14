import { createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { createFarmProgress, cropStage } from '@chibi-town/gameplay';
import { describe, expect, it } from 'vitest';
import { createDevLocalSdk, devNumber } from '@/application/_utils/dev-local-sdk';

const settings = { timeScale: 600, coins: 5000000, gems: 1000 };
describe('local development simulation', () => {
  it('clones existing progress, grants funds once and leaves the normal save untouched', async () => {
    const farm = createFarmProgress();
    farm.plots[0] = { stage: 'growing', cropId: 'tomato', wateredAt: 1000 };
    const source = createMemoryRepository(createLocalDocument(farm));
    const dev = createMemoryRepository();
    let now = 1000;
    const sdk = createDevLocalSdk(source, settings, () => now, dev);
    const first = await sdk.getInventory();
    expect(first.farm.coins).toBe(settings.coins);
    expect(first.farm.gems).toBe(settings.gems);
    expect(first.farm.plots[0]).toEqual(farm.plots[0]);
    now += 24000;
    const grown = await sdk.getInventory();
    expect(grown.serverTime).toBe(14401000);
    expect(cropStage(grown.farm.plots[0], grown.serverTime)).toBe('ripe');
    await dev.transaction((doc) => {
      doc.farm.coins = 42;
    });
    const reloaded = createDevLocalSdk(source, settings, () => now, dev);
    const next = await reloaded.getInventory();
    expect(next.serverTime).toBe(grown.serverTime);
    expect(next.farm.coins).toBe(42);
    expect(await source.transaction((doc) => doc.farm)).toEqual(farm);
  });
  it('changes speed without moving the game clock backwards or granting money again', async () => {
    const source = createMemoryRepository(),
      dev = createMemoryRepository();
    let now = 1000;
    await createDevLocalSdk(source, settings, () => now, dev).getInventory();
    now = 2000;
    const slow = createDevLocalSdk(source, { ...settings, timeScale: 1 }, () => now, dev);
    expect((await slow.getInventory()).serverTime).toBe(601000);
    now = 3000;
    expect((await slow.getInventory()).serverTime).toBe(602000);
  });
  it('uses safe defaults for invalid public configuration', () => {
    for (const input of [undefined, '', '0', '-1', 'Infinity', '600.5', '999999999'])
      expect(devNumber(input, 600, 3600)).toBe(600);
    expect(devNumber('1', 600, 3600)).toBe(1);
    expect(devNumber('3600', 600, 3600)).toBe(3600);
  });
});
