import { farmSceneUrls } from '@/assets/generated-assets';

let images: Promise<Map<string, HTMLCanvasElement>> | undefined;
const loaders = new WeakMap<Map<string, HTMLCanvasElement>, (name: string) => HTMLCanvasElement>();

/** A stable loader lets immutable animation frames survive scene teardown too. */
export function farmSceneAssetLoader(images: Map<string, HTMLCanvasElement>) {
  let loader = loaders.get(images);
  if (!loader) {
    loader = (name) => {
      const source = images.get(name);
      if (!source) throw new Error(`Missing farm asset: ${name}`);
      return source;
    };
    loaders.set(images, loader);
  }
  return loader;
}

/** Immutable artwork stays decoded across farm visits; player progress remains scene-owned. */
export function loadFarmSceneAssets(): Promise<Map<string, HTMLCanvasElement>> {
  images ??= Promise.all(
    Object.entries(farmSceneUrls).map(async ([key, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      return [key, canvas] as const;
    }),
  )
    .then((entries) => new Map(entries))
    .catch((error) => {
      images = undefined;
      throw error;
    });
  return images;
}
