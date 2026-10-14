import type { MapDefinition } from '@chibi-town/game-content';

import { entertainmentUrls } from '@/assets/generated-assets';

const cache = new Map<string, { source: Promise<HTMLCanvasElement>; users: number }>();

/** Resources are retained while any map uses them; failed loads can be retried. */
export async function acquireMapAssets(map: MapDefinition, generated = new Map<string, HTMLCanvasElement>()) {
  const urls = [...new Set(map.layers?.flatMap((layer) => (layer.asset ? [layer.asset] : [])) ?? [])];
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
          let entry = cache.get(url);
          if (!entry) {
            const source = (async () => {
              const image = new Image();
              image.src = entertainmentUrls[url] ?? url;
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.width;
              canvas.height = image.height;
              canvas.getContext('2d')!.drawImage(image, 0, 0);
              return canvas;
            })();
            entry = { source, users: 0 };
            cache.set(url, entry);
          }
          entry.users++;
          acquired.push(url);
          return [url, await entry.source] as const;
        }),
    );
    return { assets: new Map([...pairs, ...generated]), release };
  } catch (error) {
    release();
    throw error;
  }
}
