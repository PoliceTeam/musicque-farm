import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { petSheet, scenerySheet, sheet } from '@/assets/asset-catalog';
import { loadSpriteSources } from '@/assets/sprite-source-loader';
import baseline from './fixtures/sprite-baseline.json';

function fingerprint(source: typeof sheet) {
  const canonical = {
    palette: Object.keys(source.palette)
      .sort()
      .map((key) => [key, source.palette[key]]),
    pieces: Object.keys(source.pieces)
      .sort()
      .map((key) => {
        const p = source.pieces[key];
        return [key, p.width, p.height, p.rows];
      }),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

describe('item-grouped sprite sources', () => {
  it('preserves every palette, dimension, piece ID and pixel from before the split', () => {
    for (const [name, source] of Object.entries({ character: sheet, pets: petSheet, scenery: scenerySheet })) {
      const expected = baseline[name as keyof typeof baseline];
      const original = {
        palette: Object.fromEntries(expected.paletteLetters.map((key) => [key, source.palette[key]])),
        pieces: Object.fromEntries(expected.pieceNames.map((key) => [key, source.pieces[key]])),
      };
      expect(Object.keys(original.pieces)).toHaveLength(expected.count);
      expect(fingerprint(original)).toBe(expected.sha256);
    }
  });

  it('discovers a new group regardless of input ordering and isolates pet colors', () => {
    const sources = {
      './sprites/hats/new-item/sprites.txt': '@piece hat.new\nK\n',
      './sprites/pets/new-pet/sprites.txt': '@piece pet.new\nK\n',
      './sprites/pets/palette.txt': '@palette\nK #ffffff\n',
      './sprites/palettes/shared.txt': '@palette\nK #101020\n',
    };
    const result = loadSpriteSources(sources);
    expect(result.character.pieces['hat.new'].rows).toEqual(['K']);
    expect(result.character.palette.K).toBe('#101020');
    expect(result.pets.palette.K).toBe('#ffffff');
    expect(loadSpriteSources(Object.fromEntries(Object.entries(sources).reverse()))).toEqual(result);
  });

  it('rejects duplicate pieces, palette conflicts and undeclared pixel letters', () => {
    const palette = { './sprites/palettes/shared.txt': '@palette\nK #101020\n' };
    expect(() =>
      loadSpriteSources({ ...palette, 'one.txt': '@piece same\nK\n', 'two.txt': '@piece same\nK\n' }),
    ).toThrow(/defined twice/);
    expect(() => loadSpriteSources({ ...palette, 'other.txt': '@palette\nK #ffffff\n' })).toThrow(/palette letter/);
    expect(() => loadSpriteSources({ ...palette, 'bad.txt': '@piece bad\nZ\n' })).toThrow(/not in the palette/);
  });
});
