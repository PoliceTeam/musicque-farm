import { existsSync, readFileSync } from 'node:fs';
import { MAPS } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { entertainmentUrls, sceneryUrls } from '@/assets/generated-assets';
import { RACE_SCENERY_IDS } from '@/features/pet-racing/rendering/race-scene-assets';
import { sceneAssetUrl } from '@/game/rendering/map-assets';

it('street and race share common scenery sources without feature-local image copies', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../tools/scenery/assets.json', import.meta.url), 'utf8'));
  const street = MAPS.find((map) => map.id === 'entertainment-street')!;
  for (const { key, file } of manifest) {
    expect(sceneryUrls[`scenery:${key}`]).toBeTruthy();
    expect(entertainmentUrls[`entertainment:${key}`]).toBeUndefined();
    expect(existsSync(new URL(`../src/assets/entertainment/${file}`, import.meta.url))).toBe(false);
    expect(sceneAssetUrl(`entertainment:${key}`)).toBe(sceneAssetUrl(`scenery:${key}`));
  }
  for (const id of RACE_SCENERY_IDS.filter((id) => id.startsWith('scenery:')))
    expect(street.layers?.some((layer) => layer.asset === id)).toBe(true);
  expect(RACE_SCENERY_IDS.every((id) => !id.includes('race-ground'))).toBe(true);
});

it('shares decoded common assets across legacy and current IDs until the last scene releases them', async () => {
  const { vi } = await import('vitest');
  const { acquireSceneAssets } = await import('@/game/rendering/map-assets');
  const decode = vi.fn(async () => {});
  vi.stubGlobal(
    'Image',
    class {
      width = 64;
      height = 32;
      decode = decode;
    },
  );
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) });
  const leases: { release(): void }[] = [];
  try {
    const first = await acquireSceneAssets(['scenery:cloud']);
    leases.push(first);
    const second = await acquireSceneAssets(['entertainment:cloud']);
    leases.push(second);
    expect(first.assets.get('scenery:cloud')).toBe(second.assets.get('entertainment:cloud'));
    expect(decode).toHaveBeenCalledTimes(1);
    first.release();
    first.release();
    const third = await acquireSceneAssets(['scenery:cloud']);
    leases.push(third);
    expect(decode).toHaveBeenCalledTimes(1);
    second.release();
    third.release();
    leases.push(await acquireSceneAssets(['scenery:cloud']));
    expect(decode).toHaveBeenCalledTimes(2);
  } finally {
    for (const lease of leases) lease.release();
    vi.unstubAllGlobals();
  }
});
