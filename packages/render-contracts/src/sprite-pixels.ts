import type { DrawOp } from '@chibi-town/character-core/character-types';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';

/** Native RGBA pixels; clipping stays relative to the avatar's feet, as in the Canvas renderer. */
export function spritePixels(sheet: SpriteSheet, op: DrawOp) {
  const piece = sheet.pieces[op.piece];
  if (!piece) throw new Error(`missing piece "${op.piece}"`);
  const data = new Uint8ClampedArray(piece.width * piece.height * 4);
  const firstRow = Math.max(0, Math.ceil((op.clipTop ?? op.y) - op.y));
  const colors = new Map<string, number[]>();
  piece.rows.forEach((row, y) => {
    if (y < firstRow && !op.clipSpans) return;
    for (let x = 0; x < row.length; x++) {
      const span = op.clipSpans?.[y];
      if (y < firstRow && span && x >= span[0] && x < span[1]) continue;
      const letter = row[x];
      if (letter === '.') continue;
      let rgb = colors.get(letter);
      if (!rgb) {
        const hex = op.recolor?.[letter] ?? sheet.palette[letter] ?? '#ff00ff';
        rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
        colors.set(letter, rgb);
      }
      data.set([...rgb, 255], (y * piece.width + x) * 4);
    }
  });
  return { width: piece.width, height: piece.height, data };
}

/** Position and facing don't duplicate textures; only pixel content does. */
export function spriteTextureKey(sheetName: string, op: DrawOp) {
  const recolor = Object.entries(op.recolor ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    sheetName,
    op.piece,
    recolor,
    Math.max(0, Math.ceil((op.clipTop ?? op.y) - op.y)),
    op.clipSpans,
  ]);
}
