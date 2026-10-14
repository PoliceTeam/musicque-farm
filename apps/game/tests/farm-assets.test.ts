import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { farmSceneUrls, farmUrls } from '@/assets/generated-assets';

it('ships only organized WebP assets and excludes food/product icons from scene preload', () => {
  const base = fileURLToPath(new URL('../src/assets/farm/', import.meta.url));
  const files = readdirSync(base, { recursive: true }).filter(
    (name): name is string => typeof name === 'string' && name.includes('.'),
  );
  const referenced = Object.values(farmUrls).map((url) => url.replace(/^\/(?:chibi-assets|src\/assets)\/farm\//, ''));
  expect(files.sort()).toEqual([...new Set(referenced)].sort());
  for (const [key, url] of Object.entries(farmUrls)) {
    expect(url, key).toMatch(/\/farm\/(animals|crops|food|scenery)\/.+\.webp$/);
    expect(
      existsSync(
        fileURLToPath(new URL(url.replace(/^\/(?:chibi-assets|src\/assets)\//, '../src/assets/'), import.meta.url)),
      ),
      key,
    ).toBe(true);
  }
  expect(Object.keys(farmSceneUrls).length).toBeLessThan(Object.keys(farmUrls).length);
  for (const [key, url] of Object.entries(farmSceneUrls)) {
    expect(farmUrls[key]).toBe(url);
    expect(key).not.toMatch(/^food-|product-|icon$/);
  }
});
