import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/assets/generated-assets', () => ({ farmSceneUrls: { ground: '/ground.webp', fence: '/fence.webp' } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('shares concurrent loads and keeps decoded artwork for later farm visits', async () => {
  const decode = vi.fn(async () => {});
  const drawImage = vi.fn();
  vi.stubGlobal(
    'Image',
    class {
      width = 12;
      height = 8;
      decode = decode;
    },
  );
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage }) }) });
  const { farmSceneAssetLoader, loadFarmSceneAssets } = await import('@/features/farm/rendering/farm-scene-assets');
  const first = loadFarmSceneAssets();
  expect(loadFarmSceneAssets()).toBe(first);
  const images = await first;
  expect(images.size).toBe(2);
  expect(await loadFarmSceneAssets()).toBe(images);
  expect(farmSceneAssetLoader(images)).toBe(farmSceneAssetLoader(await loadFarmSceneAssets()));
  expect(decode).toHaveBeenCalledTimes(2);
  expect(drawImage).toHaveBeenCalledTimes(2);
});

it('retries artwork after a failed decode instead of keeping a rejected cache entry', async () => {
  const decode = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  vi.stubGlobal(
    'Image',
    class {
      width = 12;
      height = 8;
      decode = decode;
    },
  );
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) });
  const { loadFarmSceneAssets } = await import('@/features/farm/rendering/farm-scene-assets');
  await expect(loadFarmSceneAssets()).rejects.toThrow('offline');
  expect((await loadFarmSceneAssets()).size).toBe(2);
  expect(decode).toHaveBeenCalledTimes(4);
});
