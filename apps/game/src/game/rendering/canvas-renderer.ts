// Browser rendering. A piece is drawn from its vector art when it has some (crops, src/game/rendering/crop-art.ts)
// or else from the pixel grid in its sprite sheet (characters, assets/sprites/**/sprites.txt).
// Pieces are drawn into a canvas DETAIL times the native size and cached; the world canvas is
// DETAIL × native too. Game code always works in native pixel units.

import type { DrawOp, Recolor } from '@chibi-town/character-core/character-types';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';
import type { VectorArt } from '@/game/rendering/vector-art';

/** Upscale factor of the world canvas and all cached pieces. */
export const DETAIL = 4;
/** Room around each piece box, in native pixels: 2D art has its own proportions and may spill past the box. */
const MARGIN = 12;

/** A cached piece: `canvas` covers the piece box plus `margin` native pixels on every side. */
export type Sprite = { canvas: HTMLCanvasElement; margin: number };

export class PieceCache {
  private cache = new Map<string, Sprite>();

  constructor(
    private sheet: SpriteSheet,
    private art: Record<string, VectorArt> = {},
  ) {}

  size(name: string): { width: number; height: number } {
    const piece = this.sheet.pieces[name];
    if (!piece) throw new Error(`missing piece "${name}"`);
    return { width: piece.width, height: piece.height };
  }

  /** The piece at DETAIL resolution, recoloured. */
  get(name: string, recolor?: Recolor): Sprite {
    const key = recolor ? `${name}|${JSON.stringify(recolor)}` : name;
    let sprite = this.cache.get(key);
    if (!sprite) {
      sprite = this.draw(name, recolor);
      this.cache.set(key, sprite);
    }
    return sprite;
  }

  private draw(name: string, recolor?: Recolor): Sprite {
    const art = this.art[name];
    const { width, height } = this.size(name);
    const canvas = document.createElement('canvas');
    canvas.width = (width + 2 * MARGIN) * DETAIL;
    canvas.height = (height + 2 * MARGIN) * DETAIL;
    const g = canvas.getContext('2d')!;
    g.scale(DETAIL, DETAIL);
    g.translate(MARGIN, MARGIN);

    const colour = (letter: string) => recolor?.[letter] ?? this.sheet.palette[letter] ?? '#ff00ff';

    if (art) art(g, colour);
    else drawPixels(g, this.sheet.pieces[name].rows, colour);
    return { canvas, margin: MARGIN };
  }
}

/** Fill one native pixel per letter of a pixel-art piece ("." stays transparent). */
function drawPixels(g: CanvasRenderingContext2D, rows: string[], colour: (letter: string) => string) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = colour(row[x]);
      g.fillRect(x, y, 1, 1);
    }
  });
}

/** Draw a sprite with its piece box at (x, y), optionally mirrored within the box. Native units. */
export function drawSprite(
  g: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  boxWidth: number,
  flip = false,
) {
  const w = sprite.canvas.width / DETAIL;
  const h = sprite.canvas.height / DETAIL;
  const m = sprite.margin;
  if (!flip) {
    g.drawImage(sprite.canvas, x - m, y - m, w, h);
    return;
  }
  g.save();
  g.translate(x + boxWidth, y);
  g.scale(-1, 1);
  g.drawImage(sprite.canvas, -m, -m, w, h);
  g.restore();
}

/** Draw laid-out pieces with the character origin at (x, y), in native units. */
export function drawOps(g: CanvasRenderingContext2D, pieces: PieceCache, ops: DrawOp[], x: number, y: number) {
  for (const op of ops) {
    if (op.clipTop !== undefined) {
      const size = pieces.size(op.piece);
      g.save();
      g.beginPath();
      if (op.clipSpans) {
        for (let row = 0; row < size.height; row++) {
          const span = op.y + row < op.clipTop ? op.clipSpans[row] : undefined;
          if (!span) {
            g.rect(x + op.x, y + op.y + row, size.width, 1);
            continue;
          }
          const start = Math.max(0, Math.min(size.width, op.flip ? size.width - span[1] : span[0]));
          const end = Math.max(0, Math.min(size.width, op.flip ? size.width - span[0] : span[1]));
          g.rect(x + op.x, y + op.y + row, start, 1);
          g.rect(x + op.x + end, y + op.y + row, size.width - end, 1);
        }
      } else
        g.rect(
          x + op.x - MARGIN,
          y + op.clipTop,
          size.width + 2 * MARGIN,
          Math.max(0, op.y + size.height + MARGIN - op.clipTop),
        );
      g.clip();
    }
    drawSprite(g, pieces.get(op.piece, op.recolor), x + op.x, y + op.y, pieces.size(op.piece).width, op.flip);
    if (op.clipTop !== undefined) g.restore();
  }
}

/** Whole-figure sprites composed at full detail, cached per layout (outfit, pose and facing). */
export class FigureCache {
  private cache = new Map<string, { canvas: HTMLCanvasElement; left: number; top: number }>();

  constructor(private pieces: PieceCache) {}

  draw(g: CanvasRenderingContext2D, ops: DrawOp[], x: number, y: number) {
    const key = JSON.stringify(ops);
    let sprite = this.cache.get(key);
    if (!sprite) {
      if (this.cache.size > 400) this.cache.clear();
      sprite = this.compose(ops);
      this.cache.set(key, sprite);
    }
    g.drawImage(
      sprite.canvas,
      x + sprite.left,
      y + sprite.top,
      sprite.canvas.width / DETAIL,
      sprite.canvas.height / DETAIL,
    );
  }

  private compose(ops: DrawOp[]) {
    const sizes = ops.map((op) => this.pieces.size(op.piece));
    const m = MARGIN + 1;
    const left = Math.min(...ops.map((op) => op.x)) - m;
    const top = Math.min(...ops.map((op) => op.y)) - m;
    const right = Math.max(...ops.map((op, i) => op.x + sizes[i].width)) + m;
    const bottom = Math.max(...ops.map((op, i) => op.y + sizes[i].height)) + m;
    const canvas = document.createElement('canvas');
    canvas.width = (right - left) * DETAIL;
    canvas.height = (bottom - top) * DETAIL;
    const g = canvas.getContext('2d')!;
    g.scale(DETAIL, DETAIL);
    g.imageSmoothingQuality = 'high';
    drawOps(g, this.pieces, ops, -left, -top);
    return { canvas, left, top };
  }
}

/**
 * The world canvas (DETAIL × native size; `g` is pre-scaled so callers use native units) presented
 * on a display canvas of native × `scale` × devicePixelRatio.
 */
