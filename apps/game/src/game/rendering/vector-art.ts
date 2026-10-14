// Small helpers for drawing vector art with the 2D canvas API. Art functions draw in a piece's
// own native units (the same box as its pixel version) and read colours through `c(letter)`, so
// palette recolouring (hair colour, skin tone...) works for vector art too.

export type Colour = (letter: string) => string;
export type VectorArt = (g: CanvasRenderingContext2D, c: Colour) => void;

/** Outline width in native pixels. */
export const LINE = 0.55;

export type Paint = string | CanvasGradient;

export function shape(
  g: CanvasRenderingContext2D,
  d: string | Path2D,
  fill: Paint | null,
  line?: string,
  width = LINE,
) {
  const p = typeof d === 'string' ? new Path2D(d) : d;
  if (fill) {
    g.fillStyle = fill;
    g.fill(p);
  }
  if (line) {
    g.strokeStyle = line;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke(p);
  }
}

export function stroke(g: CanvasRenderingContext2D, d: string, colour: string, width = LINE, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  shape(g, d, null, colour, width);
  g.restore();
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  return p;
}

export function rounded(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
}

export function linear(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [at, colour] of stops) gr.addColorStop(at, colour);
  return gr;
}

export function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, colour] of stops) gr.addColorStop(at, colour);
  return gr;
}

/** Mix a #rrggbb colour towards black (amount < 0) or white (amount > 0). */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);

  const mix = (v: number) => Math.round(v + (target - v) * k);

  const r = mix((n >> 16) & 255);
  const gch = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (gch << 8) | b).toString(16).slice(1)}`;
}

/** Draw `art` mirrored about the vertical line x = axis (for symmetric pairs like wings). */
export function mirrored(g: CanvasRenderingContext2D, axis: number, art: () => void) {
  g.save();
  g.translate(axis * 2, 0);
  g.scale(-1, 1);
  art();
  g.restore();
}
