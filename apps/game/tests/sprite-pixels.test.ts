import type { DrawOp } from '@chibi-town/character-core/character-types';
import { spritePixels, spriteTextureKey } from '@chibi-town/render-contracts/sprite-pixels';
import { describe, expect, it } from 'vitest';
import { parseSprites } from '@/assets/sprite-parser';

const sheet = parseSprites('@palette\nK #101020\nH #804020\n\n@piece hair\nKH\n.H\n\n');
const op: DrawOp = { piece: 'hair', x: -1, y: -2, flip: false, recolor: { H: '#abcdef' } };

describe('shared sprite pixels', () => {
  it('preserves the outline, recoloured pixels and transparent holes', () => {
    expect([...spritePixels(sheet, op).data]).toEqual([
      16, 16, 32, 255, 171, 205, 239, 255, 0, 0, 0, 0, 171, 205, 239, 255,
    ]);
  });

  it('clips hair above the brim without changing the piece size or remaining pixels', () => {
    const pixels = spritePixels(sheet, { ...op, clipTop: -1 });
    expect([pixels.width, pixels.height]).toEqual([2, 2]);
    expect([...pixels.data]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 171, 205, 239, 255]);
    expect(spritePixels(sheet, { ...op, clipTop: 1 }).data.every((v) => v === 0)).toBe(true);
  });

  it('shares textures across movement and facing while keeping colours, clips and sheets separate', () => {
    const key = spriteTextureKey('character', op);
    expect(spriteTextureKey('character', { ...op, x: 14, y: 5, flip: true })).toBe(key);
    expect(spriteTextureKey('character', { ...op, recolor: { H: '#ffffff' } })).not.toBe(key);
    expect(spriteTextureKey('character', { ...op, clipTop: -1 })).not.toBe(key);
    expect(spriteTextureKey('pet', op)).not.toBe(key);
  });

  it('keeps strands outside the hat silhouette above its brim and separates cached masks', () => {
    const shaped = {
      ...op,
      clipTop: -1,
      clipSpans: [
        [1, 2],
        [0, 1],
      ] as [number, number][],
    };
    const pixels = spritePixels(sheet, shaped);
    expect([...pixels.data]).toEqual([16, 16, 32, 255, 0, 0, 0, 0, 0, 0, 0, 0, 171, 205, 239, 255]);
    expect(spriteTextureKey('character', shaped)).not.toBe(spriteTextureKey('character', { ...op, clipTop: -1 }));
    expect(spriteTextureKey('character', { ...shaped, flip: true })).toBe(spriteTextureKey('character', shaped));
  });
});
