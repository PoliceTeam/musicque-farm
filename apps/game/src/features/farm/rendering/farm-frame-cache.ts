type AssetLoader = (name: string) => HTMLCanvasElement;
const caches = new WeakMap<AssetLoader, Map<string, unknown>>();

/** Immutable frames survive rebuilds and visits while their artwork loader is retained. */
export function cachedFarmFrames<T>(asset: AssetLoader, key: string, build: () => T): T {
  let cache = caches.get(asset);
  if (!cache) {
    cache = new Map();
    caches.set(asset, cache);
  }
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key) as T;
}
