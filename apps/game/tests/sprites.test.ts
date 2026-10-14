import { colors, items } from '@chibi-town/character-core/item-catalog';
import { describe, expect, it } from 'vitest';
import { sheet } from '@/assets/asset-catalog';
import { mergeSheets, parseSprites } from '@/assets/sprite-parser';

describe('parseSprites', () => {
  it('reads palette and pieces', () => {
    const s = parseSprites('@palette\nK #000000\nS #ffffff\n\n@piece dot\n.K.\nKSK\n');
    expect(s.palette).toEqual({ K: '#000000', S: '#ffffff' });
    expect(s.pieces.dot).toMatchObject({ width: 3, height: 2, rows: ['.K.', 'KSK'] });
  });

  it('rejects ragged rows, unknown letters and duplicates', () => {
    expect(() => parseSprites('@palette\nK #000000\n\n@piece a\nKK\nK\n')).toThrow(/wide/);
    expect(() => parseSprites('@palette\nK #000000\n\n@piece a\nKZ\n')).toThrow(/"Z"/);
    expect(() => parseSprites('@palette\nK #000000\n\n@piece a\nK\n\n@piece a\nK\n')).toThrow(/duplicate/);
  });

  it('refuses conflicting palette letters when merging', () => {
    const a = parseSprites('@palette\nK #000000\n');
    const b = parseSprites('@palette\nK #111111\n');
    expect(() => mergeSheets(a, b)).toThrow(/palette letter/);
  });
});

describe('game assets', () => {
  it('load without errors', () => {
    expect(Object.keys(sheet.pieces).length).toBeGreaterThan(10);
    expect(Object.keys(items).length).toBeGreaterThan(10);
  });

  it('recolour only letters that exist in the palette', () => {
    for (const [group, variants] of Object.entries(colors)) {
      for (const [name, map] of Object.entries(variants)) {
        for (const letter of Object.keys(map)) expect(sheet.palette, `${group}/${name}`).toHaveProperty(letter);
      }
    }
  });
});
