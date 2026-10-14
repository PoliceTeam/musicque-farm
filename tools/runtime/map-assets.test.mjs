import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = new URL('../../apps/game/', import.meta.url);
const sharp = createRequire(new URL('package.json', app))('sharp');

test('packed map sprites keep dimensions, alpha and visible pixels from source artwork', async () => {
  const manifest = await readFile(new URL('src/assets/generated-map-assets.ts', app), 'utf8');
  const atlas = JSON.parse(manifest.split('export const mapSpriteAtlas = ')[1].replace(/;\s*$/, ''));
  const image = new URL(`public${atlas.url.split('?')[0]}`, app);
  assert.ok(Object.keys(atlas.data.frames).length > 20);
  for (const [name, { frame }] of Object.entries(atlas.data.frames)) {
    assert.ok(!name.startsWith('label-'));
    const source = await sharp(await readFile(new URL(`src/assets/map/sprites/${name}.png`, app)))
      .ensureAlpha().raw().toBuffer();
    const packed = await sharp(await readFile(image))
      .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h }).ensureAlpha().raw().toBuffer();
    assert.equal(packed.length, source.length, name);
    for (let i = 0; i < source.length; i += 4) {
      assert.equal(packed[i + 3], source[i + 3], `${name}: alpha`);
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs((source[i + channel] - packed[i + channel]) * source[i + 3] / 255);
        assert.ok(difference <= 1, `${name}: visible pixel at ${i / 4}`);
      }
    }
  }
});
