// Text pixel-art format: a palette of single-letter colours and pieces drawn as character grids.
//
//   @palette
//   K #2b1a14
//   @piece head
//   ..KKKK..
//   .KSSSSK.
//
// "." is transparent. Lines starting with "#" are comments; a blank line ends a section.
// See docs/art-guide.md.

import type { Piece, SpriteSheet } from '@chibi-town/character-core/sprite-types';

const COLOUR = /^#[0-9a-f]{6}$/i;

export function parseSprites(
  text: string,
  source = 'sprites',
  sharedPalette: Record<string, string> = {},
): SpriteSheet {
  const palette: Record<string, string> = { ...sharedPalette };
  const pieces: Record<string, Piece> = {};
  let section: 'palette' | Piece | null = null;

  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    const where = `${source}:${index + 1}`;
    if (!line.trim()) {
      section = null;
      return;
    }
    if (line.startsWith('#')) return;
    if (line === '@palette') {
      section = 'palette';
      return;
    }
    if (line.startsWith('@piece ')) {
      const name = line.slice(7).trim();
      if (pieces[name]) throw new Error(`${where}: duplicate piece "${name}"`);
      section = pieces[name] = { name, width: 0, height: 0, rows: [] };
      return;
    }
    if (section === 'palette') {
      const [letter, colour] = line.trim().split(/\s+/);
      if (letter.length !== 1 || letter === '.' || !COLOUR.test(colour ?? '')) {
        throw new Error(`${where}: palette lines are "<letter> #rrggbb"`);
      }
      const normalized = colour.toLowerCase();
      if (palette[letter] && palette[letter] !== normalized)
        throw new Error(`${where}: conflicting palette letter "${letter}"`);
      palette[letter] = normalized;
      return;
    }
    if (!section) throw new Error(`${where}: pixels outside a @piece`);
    const piece = section;
    if (piece.rows.length && line.length !== piece.width) {
      throw new Error(`${where}: row is ${line.length} wide, piece "${piece.name}" is ${piece.width}`);
    }
    piece.rows.push(line);
    piece.width = line.length;
    piece.height = piece.rows.length;
  });

  for (const piece of Object.values(pieces)) {
    for (const row of piece.rows) {
      for (const letter of row) {
        if (letter !== '.' && !(letter in palette)) {
          throw new Error(`${source}: piece "${piece.name}" uses "${letter}", which is not in the palette`);
        }
      }
    }
  }
  return { palette, pieces };
}

// Combine sheets; a letter may appear in several palettes only with the same colour.
export function mergeSheets(...sheets: SpriteSheet[]): SpriteSheet {
  const merged: SpriteSheet = { palette: {}, pieces: {} };
  for (const sheet of sheets) {
    for (const [letter, colour] of Object.entries(sheet.palette)) {
      const existing = merged.palette[letter];
      if (existing && existing !== colour) throw new Error(`palette letter "${letter}" is ${existing} and ${colour}`);
      merged.palette[letter] = colour;
    }
    for (const [name, piece] of Object.entries(sheet.pieces)) {
      if (merged.pieces[name]) throw new Error(`piece "${name}" is defined twice`);
      merged.pieces[name] = piece;
    }
  }
  return merged;
}
