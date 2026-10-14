// Special effects for top-level upgrades: themed pixel particles (sparkle at rest, a short trail
// while moving) and a rarity ring under the feet. Data-driven: items and pets name an `effect` kind
// and an `aura` rank; nothing here knows about wings or pets specifically.

/** Particle styles. Each is a small set of colours plus how the specks move. */
export type EffectKind =
  | 'embers'
  | 'snow'
  | 'smoke'
  | 'petals'
  | 'leaves'
  | 'sparkle'
  | 'stars'
  | 'sparks'
  | 'spirit'
  | 'crystal'
  | 'cinder'
  | 'blossom'
  | 'arcane';
/** Rarity ring under the feet: 1 epic (purple), 2 legendary (gold), 3 mythic (rainbow). */
export type Aura = 0 | 1 | 2 | 3;

type Style = {
  colors: string[];
  vx: number;
  vy: number;
  sway: number;
  life: [number, number];
  size: [number, number];
  gravity: number;
  rate?: [number, number];
};

/** Velocities in native px per second; negative vy rises. */
export const STYLES: Record<EffectKind, Style> = {
  crystal: {
    colors: ['#ffe066', '#fff3bf', '#68d9f1', '#c3f5ff'],
    vx: 1,
    vy: -4,
    sway: 1,
    life: [0.6, 1.0],
    size: [1, 1],
    gravity: 0,
    rate: [6, 10],
  },
  arcane: {
    colors: ['#ffe066', '#fff3bf', '#68d9f1', '#eef6ff'],
    vx: 1,
    vy: -4,
    sway: 1,
    life: [0.6, 1.0],
    size: [1, 1],
    gravity: 0,
    rate: [6, 10],
  },
  // Same light touch as crystal, for Lv.3 hats in warm red (beanie, horns) and pink (cat, bunny hoods).
  cinder: {
    colors: ['#ffd43b', '#ff9f1c', '#ff5a1f', '#ffe8cc'],
    vx: 1,
    vy: -5,
    sway: 1,
    life: [0.5, 0.9],
    size: [1, 1],
    gravity: 0,
    rate: [6, 10],
  },
  blossom: {
    colors: ['#ffffff', '#ffc9de', '#faa2c1', '#e5dbff'],
    vx: 1,
    vy: -4,
    sway: 2,
    life: [0.6, 1.0],
    size: [1, 1],
    gravity: 0,
    rate: [6, 10],
  },
  embers: {
    colors: ['#ffd43b', '#ff9f1c', '#ff5a1f', '#c92a2a'],
    vx: 4,
    vy: -16,
    sway: 3,
    life: [0.5, 1.0],
    size: [1, 3],
    gravity: 0,
  },
  snow: {
    colors: ['#ffffff', '#d0ebff', '#a5d8ff', '#74c0fc'],
    vx: 3,
    vy: 8,
    sway: 5,
    life: [0.8, 1.4],
    size: [1, 3],
    gravity: 0,
  },
  smoke: {
    colors: ['#9c36b5', '#6741d9', '#3b1e54', '#cc5de8'],
    vx: 3,
    vy: -9,
    sway: 4,
    life: [0.7, 1.3],
    size: [1, 3],
    gravity: 0,
  },
  petals: {
    colors: ['#ffc9de', '#faa2c1', '#ffffff', '#f783ac'],
    vx: 6,
    vy: 7,
    sway: 8,
    life: [0.8, 1.4],
    size: [1, 3],
    gravity: 0,
  },
  leaves: {
    colors: ['#b2f2bb', '#69db7c', '#40c057', '#fff3bf'],
    vx: 6,
    vy: 7,
    sway: 8,
    life: [0.8, 1.4],
    size: [1, 3],
    gravity: 0,
  },
  sparkle: {
    colors: ['#ffffff', '#fff3bf', '#ffe066', '#e7f5ff'],
    vx: 2,
    vy: -6,
    sway: 1,
    life: [0.4, 0.8],
    size: [1, 1],
    gravity: 0,
  },
  stars: {
    colors: ['#ffe066', '#fcc419', '#ffffff', '#ffd43b'],
    vx: 3,
    vy: -7,
    sway: 2,
    life: [0.5, 0.9],
    size: [1, 3],
    gravity: 0,
  },
  sparks: {
    colors: ['#e7f5ff', '#74c0fc', '#4dabf7', '#ffffff'],
    vx: 14,
    vy: -10,
    sway: 0,
    life: [0.2, 0.45],
    size: [1, 1],
    gravity: 40,
  },
  spirit: {
    colors: ['#ffdeeb', '#ff8787', '#f06595', '#ffffff'],
    vx: 2,
    vy: -12,
    sway: 4,
    life: [0.6, 1.1],
    size: [1, 3],
    gravity: 0,
  },
};

/** Where specks appear, relative to the emitter's origin (feet / pet base). */
export type Area = { x0: number; x1: number; y0: number; y1: number };

/** Colour of the ring for a rank at time `now` (ms); mythic cycles through the rainbow. */
export function auraColor(aura: Aura, now: number): string {
  if (aura === 3) return `hsl(${Math.floor(now / 12) % 360}, 90%, 62%)`;
  return aura === 2 ? '#ffb000' : '#b46bff';
}

/** Name-tag border colour for a rank (none below epic). */
export function auraTagColor(aura: Aura, now: number): string | undefined {
  return aura ? auraColor(aura, now) : undefined;
}

export const isEffect = (k?: string): k is EffectKind => !!k && k in STYLES;

/** Area around the back where wing specks appear (facing right; mirrored when facing left). */
/** Two boxes beside the body (where the wings are), so specks don't cover the face. */
export const GEAR_AREA: Area[] = [
  { x0: -38, x1: -16, y0: -62, y1: -22 },
  { x0: 12, x1: 34, y0: -62, y1: -22 },
];

export const mirrorArea = (a: Area, mirror: boolean): Area =>
  mirror ? { x0: -a.x1, x1: -a.x0, y0: a.y0, y1: a.y1 } : a;

export const mirrorAreas = (a: Area[], mirror: boolean): Area[] => a.map((b) => mirrorArea(b, mirror));

/** Crown and badge only: all particles spawn above the face and rise gently. */
export function hatAreas(dx: number, dy: number, width: number, height: number, mirror: boolean): Area[] {
  return mirrorAreas(
    [
      { x0: dx + 5, x1: dx + width - 5, y0: dy - 2, y1: dy + 4 },
      { x0: dx + width * 0.5, x1: dx + width * 0.75, y0: dy + height * 0.3, y1: dy + height * 0.55 },
    ],
    mirror,
  );
}

export type HatLight = { x: number; y: number; color: string };

/** Attached lights stay on the ornament; unlike emitted particles they never leave a trail. */
export function hatLights(
  id: string,
  dx: number,
  dy: number,
  width: number,
  height: number,
  mirror: boolean,
  now: number,
): HatLight[] {
  const match = /^hat\.(wizard|crown|halo)\.([45])(?:\.w\d)?$/.exec(id);
  if (!match) return [];
  const [, family, level] = match;
  const phase = now / 1000;
  const lights: HatLight[] = [];

  const point = (u: number, v: number, color = '#fff3bf') => {
    const x = Math.round(dx + u * (width - 1)) + 0;
    lights.push({ x: mirror ? -x - 1 : x, y: Math.round(dy + v * (height - 1)), color });
  };

  const star = (u: number, v: number, cyan = false) => {
    point(u, v, '#ffffff');
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      point(u + ox / (width - 1), v + oy / (height - 1), cyan ? '#a8edff' : '#ffe066');
  };

  const pulse = Math.sin((phase * Math.PI * 2) / 2.4);
  if (pulse > 0.65) {
    if (family === 'wizard') star(0.7, level === '5' ? 0.46 : 0.56, true);
    else if (family === 'crown') star(0.5, 0.46);
    else star(0.5, 0.3);
  }
  if (level === '5') {
    if (family === 'halo') {
      // Two small lights trace the hollow ring, leaving its silhouette readable.
      for (const offset of [0, Math.PI]) {
        const angle = phase * 1.6 + offset;
        point(0.5 + Math.cos(angle) * 0.35, 0.47 + Math.sin(angle) * 0.16, '#ffffff');
        point(0.5 + Math.cos(angle - 0.13) * 0.35, 0.47 + Math.sin(angle - 0.13) * 0.16);
      }
    } else if (family === 'crown') {
      const left = Math.floor(phase / 1.2) % 2 === 0;
      const fold = [1, 0.86, 0.68, 0.86][Math.floor(Math.max(0, now) / 200) % 4];
      const wingY = (26 + (0.65 * (height - 1) - 26) * fold) / (height - 1);
      if (Math.sin((phase * Math.PI) / 1.2) ** 2 > 0.8) star(left ? 0.12 : 0.88, wingY);
    } else {
      // A short cyan shimmer follows the lower gold band, below the jewel.
      const t = (phase % 3) / 3;
      if (t < 0.55) {
        point(0.22 + t * 0.9, 0.79 - Math.sin((t * Math.PI) / 0.55) * 0.08, '#a8edff');
        point(0.22 + t * 0.9 - 1 / width, 0.79 - Math.sin((t * Math.PI) / 0.55) * 0.08, '#ffffff');
      }
    }
  }
  return lights;
}

/** Strongest effect and highest aura among a set of things (items or pets) that may carry them. */
export function strongest(things: { effect?: string; aura?: number }[]): { effect?: EffectKind; aura: Aura } {
  let best: { effect?: EffectKind; aura: Aura } = { aura: 0 };
  for (const t of things) {
    const aura = Math.max(0, Math.min(3, t.aura ?? 0)) as Aura;
    if (aura > best.aura || (aura === best.aura && !best.effect && isEffect(t.effect)))
      best = { effect: isEffect(t.effect) ? t.effect : best.effect, aura };
    else if (!best.effect && isEffect(t.effect)) best.effect = t.effect;
  }
  return best;
}
