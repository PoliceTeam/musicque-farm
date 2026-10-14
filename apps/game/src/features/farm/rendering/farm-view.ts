// The farm map: layout constants and scenery, drawn in native pixels.

import { seededRandom } from '@chibi-town/character-core/random';
import { scenerySheet } from '@/assets/asset-catalog';
import { FENCE_Y, FIELD, HORIZON, PATH_TOP, TILE, TREE, WORLD } from '@/devtools/town/_utils/town-map';
import { cropArt } from '@/features/farm/rendering/crop-art';
import { DETAIL, PieceCache } from '@/game/rendering/canvas-renderer';
import { ellipse, linear, radial, rounded, shape, stroke } from '@/game/rendering/vector-art';

const FENCE = { width: WORLD.width, height: 18 };
const TREE_SIZE = { width: 60, height: 70 };

export class Farm {
  private ground = layer2d(WORLD.width, WORLD.height, paintGround2d);
  private fence = layer2d(FENCE.width, FENCE.height, paintFence2d);
  private tree = layer2d(TREE_SIZE.width, TREE_SIZE.height, paintTree2d);

  private pieces = new PieceCache(scenerySheet, cropArt);

  /** Static artwork is baked once, then submitted as Phaser textures. */
  surfaces() {
    const melon = this.pieces.get('melon');
    const { height: mh } = this.pieces.size('melon');
    const list = [
      { key: 'ground', source: this.ground, x: 0, y: 0, width: WORLD.width, height: WORLD.height, depth: -1 },
      {
        key: 'fence',
        source: this.fence,
        x: 0,
        y: FENCE_Y - FENCE.height,
        width: FENCE.width,
        height: FENCE.height,
        depth: FENCE_Y,
      },
      {
        key: 'tree',
        source: this.tree,
        x: TREE.x - TREE_SIZE.width / 2,
        y: TREE.y - TREE_SIZE.height,
        width: TREE_SIZE.width,
        height: TREE_SIZE.height,
        depth: TREE.y,
      },
    ];
    for (const y of FIELD.rows)
      for (let c = 0; c < FIELD.cols; c++) {
        list.push({
          key: 'melon',
          source: melon.canvas,
          x: FIELD.x + c * TILE.width + 3 - melon.margin,
          y: y - 3 - mh - melon.margin,
          width: melon.canvas.width / DETAIL,
          height: melon.canvas.height / DETAIL,
          depth: y - 3,
        });
      }
    return list;
  }
}

// --- scenery painters ----------------------------------------------------------------------------
/** A layer painted with vector shapes at DETAIL resolution, in native units. */
function layer2d(width: number, height: number, paint: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width * DETAIL;
  canvas.height = height * DETAIL;
  const g = canvas.getContext('2d')!;
  g.scale(DETAIL, DETAIL);
  paint(g);
  return canvas;
}

function paintGround2d(g: CanvasRenderingContext2D) {
  const random = seededRandom(11);
  const { width: W, height: H } = WORLD;
  g.fillStyle = linear(g, 0, 0, 0, HORIZON, [
    [0, '#5aaee8'],
    [0.7, '#a9dcf5'],
    [1, '#d8f0fa'],
  ]);
  g.fillRect(0, 0, W, HORIZON);
  for (const [x, r, a] of [
    [60, 18, 0.5],
    [190, 26, 0.45],
    [330, 20, 0.5],
    [440, 16, 0.4],
  ] as [number, number, number][]) {
    g.save();
    g.globalAlpha = a;
    shape(g, ellipse(x, 22, r * 1.6, r * 0.5), '#ffffff');
    shape(g, ellipse(x + r * 0.6, 18, r * 0.9, r * 0.45), '#ffffff');
    g.restore();
  }
  shape(
    g,
    `M0 ${HORIZON} C80 ${HORIZON - 22} 160 ${HORIZON - 6} 240 ${HORIZON - 16} C320 ${HORIZON - 26} 400 ${HORIZON - 8} ${W} ${HORIZON - 18} V${HORIZON + 2} H0 Z`,
    linear(g, 0, HORIZON - 26, 0, HORIZON, [
      [0, '#8fcf6f'],
      [1, '#6db24f'],
    ]),
  );
  for (let x = -6; x < W + 10; x += 12 + random() * 10) {
    const r = 5 + random() * 5;
    shape(
      g,
      ellipse(x, HORIZON - 2 - r * 0.6, r, r * 0.9),
      radial(g, x - r * 0.3, HORIZON - 4 - r, r * 1.8, [
        [0, '#5fb04a'],
        [1, '#2f7a2c'],
      ]),
    );
  }
  g.fillStyle = linear(g, 0, HORIZON, 0, H, [
    [0, '#86cf5e'],
    [1, '#6fbb4c'],
  ]);
  g.fillRect(0, HORIZON, W, H - HORIZON);
  g.save();
  g.globalAlpha = 0.12;
  for (let y = HORIZON + 6; y < H; y += 16) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, y, W, 7);
  }
  g.restore();
  for (let i = 0; i < 420; i++) {
    const x = random() * W;
    const y = HORIZON + 4 + random() * (H - HORIZON);
    stroke(g, `M${x} ${y} l-0.7 -1.8 M${x} ${y} l0.7 -2`, random() < 0.5 ? '#4f9a3a' : '#a9e07f', 0.4, 0.8);
  }
  shape(
    g,
    `M0 ${PATH_TOP} C120 ${PATH_TOP - 3} 240 ${PATH_TOP + 3} 360 ${PATH_TOP - 2} C420 ${PATH_TOP - 4} 450 ${PATH_TOP} ${W} ${PATH_TOP - 1} V${H} H0 Z`,
    linear(g, 0, PATH_TOP, 0, H, [
      [0, '#e2c992'],
      [1, '#c9ab70'],
    ]),
    '#b89b62',
    0.5,
  );
  for (let i = 0; i < 70; i++)
    shape(
      g,
      ellipse(random() * W, PATH_TOP + 5 + random() * (H - PATH_TOP - 7), 0.6 + random(), 0.4 + random() * 0.5),
      '#b0915a',
    );
  for (const y of FIELD.rows) {
    for (let c = 0; c < FIELD.cols; c++) {
      const x = FIELD.x + c * TILE.width;
      shape(
        g,
        rounded(x + 1, y - 19, TILE.width - 2, 18, 4),
        linear(g, 0, y - 19, 0, y - 1, [
          [0, '#8a5a35'],
          [1, '#6c4226'],
        ]),
        '#4e2e18',
        0.5,
      );
      shape(
        g,
        rounded(x + 2.5, y - 17.5, TILE.width - 5, 14, 3.5),
        linear(g, 0, y - 17, 0, y - 3, [
          [0, '#a8744a'],
          [1, '#93613a'],
        ]),
      );
      for (let k = 0; k < 4; k++)
        shape(g, ellipse(x + 5 + random() * (TILE.width - 10), y - 15 + random() * 10, 0.6, 0.4), '#6c4226');
    }
  }
}

function paintFence2d(g: CanvasRenderingContext2D) {
  const W = WORLD.width;
  for (const ry of [5, 11])
    shape(
      g,
      rounded(0, ry, W, 2.8, 1.2),
      linear(g, 0, ry, 0, ry + 2.8, [
        [0, '#d9a066'],
        [1, '#a8723f'],
      ]),
      '#4e2e18',
      0.5,
    );
  for (let x = 4; x < W; x += 16) {
    shape(
      g,
      `M${x} 17.6 V2.2 L${x + 2.5} 0.2 L${x + 5} 2.2 V17.6 Z`,
      linear(g, x, 0, x + 5, 0, [
        [0, '#e0aa70'],
        [0.5, '#c48a52'],
        [1, '#9a6538'],
      ]),
      '#4e2e18',
      0.5,
    );
    stroke(g, `M${x + 1.6} 3.5 V15`, '#f0c08a', 0.4, 0.7);
  }
}

function paintTree2d(g: CanvasRenderingContext2D) {
  shape(
    g,
    'M25.5 70 C26.5 58 25 48 26 40 H34 C35 48 33.5 58 34.5 70 Z',
    linear(g, 25, 0, 35, 0, [
      [0, '#6e4422'],
      [0.5, '#9a6638'],
      [1, '#7a4c28'],
    ]),
    '#3b2414',
    0.6,
  );
  stroke(g, 'M28.5 44 Q29.5 55 28.5 66 M31.5 46 Q32.5 56 31.6 64', '#5e3a1c', 0.5, 0.7);
  const blobs: [number, number, number][] = [
    [18, 31, 12.5],
    [42, 31, 12.5],
    [30, 21, 15.5],
    [21, 15, 10.5],
    [39, 15, 10.5],
  ];
  for (const [x, y, r] of blobs) shape(g, ellipse(x, y, r + 0.6, r + 0.6), '#1d3d14');
  for (const [x, y, r] of blobs)
    shape(
      g,
      ellipse(x, y, r, r),
      radial(g, x - r * 0.35, y - r * 0.45, r * 1.5, [
        [0, '#8fd06a'],
        [0.45, '#4fa33a'],
        [1, '#2c7027'],
      ]),
    );
  for (const [x, y, r] of blobs) {
    g.save();
    g.globalAlpha = 0.35;
    shape(g, ellipse(x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.25), '#d6f5b0');
    g.restore();
  }
}
