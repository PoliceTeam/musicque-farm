import type { MapDefinition } from '@chibi-town/game-content';

import { entertainmentUrls, publicAssetUrls, salonUrls, sceneryUrls, shoppingUrls } from '@/assets/generated-assets';

const cache = new Map<string, { source: Promise<HTMLCanvasElement>; users: number }>();

/** Old API map snapshots may still use entertainment IDs during a rolling update. */
export function sceneAssetUrl(id: string) {
  return (
    sceneryUrls[id] ??
    sceneryUrls[id.replace('entertainment:', 'scenery:')] ??
    salonUrls[id] ??
    shoppingUrls[id] ??
    entertainmentUrls[id] ??
    publicAssetUrls[id] ??
    id
  );
}

/** Resources are retained while any map uses them; failed loads can be retried. */
export function acquireMapAssets(map: MapDefinition, generated = new Map<string, HTMLCanvasElement>()) {
  return acquireSceneAssets(map.layers?.flatMap((layer) => (layer.asset ? [layer.asset] : [])) ?? [], generated);
}

/** Shared leases for standalone scenes and maps; IDs resolve to one common source URL. */
export async function acquireSceneAssets(ids: readonly string[], generated = new Map<string, HTMLCanvasElement>()) {
  const urls = [...new Set(ids)];
  const acquired: string[] = [];

  function release() {
    for (const url of acquired.splice(0)) {
      const item = cache.get(url);
      if (item && --item.users === 0) cache.delete(url);
    }
  }

  try {
    const pairs = await Promise.all(
      urls
        .filter((url) => !generated.has(url))
        .map(async (url) => {
          const sourceUrl = sceneAssetUrl(url);
          let entry = cache.get(sourceUrl);
          if (!entry) {
            const source = (async () => {
              const image = new Image();
              image.src = sourceUrl;
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.width;
              canvas.height = image.height;
              canvas.getContext('2d')!.drawImage(image, 0, 0);
              return canvas;
            })();
            entry = { source, users: 0 };
            cache.set(sourceUrl, entry);
          }
          entry.users++;
          acquired.push(sourceUrl);
          return [url, await entry.source] as const;
        }),
    );
    return { assets: new Map([...pairs, ...generated]), release };
  } catch (error) {
    release();
    throw error;
  }
}
