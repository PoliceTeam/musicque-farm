import type { AvatarState } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { sheet } from '@/assets/asset-catalog';
import { FARM_CHARACTER_SCALE } from '@/features/farm/_utils/farm-layout';
import {
  ENTRANCE_FENCE_SEGMENTS,
  ENTRANCE_FENCE_Y,
  ENTRANCE_SIZE,
  ENTRANCE_TARGETS,
} from '@/features/farm-entrance/_utils/entrance-layout';
import { createEntranceTerrain } from '@/features/farm-entrance/rendering/entrance-terrain-view';
import { drawAvatarLabel } from '@/game/rendering/avatar-label';
import { createEntranceHint, drawEntranceHint } from '@/game/rendering/entrance-hint';
import { npcPlacement } from '@/game/rendering/npc-placement';

const feature = (key: string) => `farm-entrance/${key}.webp`;

const SCENERY = [
  'farmstead-sky',
  'farmstead-mountains',
  'farmstead-woodland',
  'farmstead-tree-yellow',
  'farmstead-tree-orange',
  'farmstead-tree-green',
  'farmstead-distant-tree',
  'farmstead-hedge-low',
  'farmstead-hedge-tall',
  'farmstead-hedge-wide',
  'farmstead-daisies',
  'farmstead-flower-rocks',
  'farmstead-flower-bush',
  'farmstead-flowers-yellow',
  'farmstead-flowers-red',
  'farmstead-fence-long',
  'farmstead-fence-end-left',
  'farmstead-fence-end-right',
  'farmstead-grass-tuft',
  'farmstead-rock',
  'farmstead-lantern',
  'farmstead-pink-pot',
  'farmstead-crate',
  'farmstead-logs',
  'country-dirt',
  'meadow-grass',
];
export const ENTRANCE_ASSETS = [
  ...SCENERY.map((key) => `scenery:${key}`),
  ...['gate', 'shop', 'market', 'notice', 'chest', 'farm-sign', 'farmer', 'gardener'].map(feature),
];

type Prop = {
  key: string;
  source: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

/** Independent scenery pieces share a ground plane and retain their source aspect ratios. */
export function createFarmEntranceView(assets: Map<string, HTMLCanvasElement>, name: string) {
  const arrow = createEntranceHint('');

  const asset = (key: string) => assets.get(`scenery:${key}`)!;

  const ground = createEntranceTerrain(asset);
  const props: Prop[] = [];

  const put = (
    key: string,
    source: HTMLCanvasElement,
    x: number,
    baseline: number,
    width: number,
    height = (width * source.height) / source.width,
  ) => {
    props.push({ key, source, x: x - width / 2, y: baseline - height, width, height, depth: baseline });
  };

  // Sparse small trees establish distance; the large autumn canopies frame the square.
  for (const [index, [x, baseline, width]] of [
    [111, 411, 70],
    [220, 413, 72],
    [538, 411, 77],
    [835, 411, 82],
    [1050, 413, 74],
  ].entries())
    put(`distant-tree-${index}`, asset('farmstead-distant-tree'), x, baseline, width);

  // Crop each rail span rather than allowing a final repeated tile across a doorway.
  for (const [index, [start, end]] of ENTRANCE_FENCE_SEGMENTS.entries()) {
    const rail = document.createElement('canvas');
    rail.width = end - start;
    rail.height = 56;
    const paint = rail.getContext('2d')!;
    const source = asset('farmstead-fence-long');
    const tileWidth = (56 * source.width) / source.height;
    for (let x = 0; x < rail.width; x += tileWidth - 12) paint.drawImage(source, x, 0, tileWidth, 56);
    if (end === 130 || start === 200) {
      const cap = asset(end === 130 ? 'farmstead-fence-end-left' : 'farmstead-fence-end-right');
      const capWidth = (56 * cap.width) / cap.height;
      const capX = end === 130 ? rail.width - capWidth : 0;
      paint.clearRect(capX, 0, capWidth, 56);
      paint.drawImage(cap, capX, 0, capWidth, 56);
    }
    put(`rear-fence-${index}`, rail, (start + end) / 2, ENTRANCE_FENCE_Y, end - start, 56);
  }
  put('left-canopy', asset('farmstead-tree-orange'), 0, 467, 305);
  put('right-canopy', asset('farmstead-tree-orange'), 1167, 465, 263);
  put('right-yellow-canopy', asset('farmstead-tree-yellow'), 1315, 469, 246);
  put('gate', assets.get(feature('gate'))!, 325, 466, 200);
  put('shop', assets.get(feature('shop'))!, 700, 469, 215);
  put('market', assets.get(feature('market'))!, 963, 485, 190);
  put('notice', assets.get(feature('notice'))!, 511, 482, 110);
  put('chest', assets.get(feature('chest'))!, 78, 515, 78);
  put('farm-sign', assets.get(feature('farm-sign'))!, 1185, 500, 130);
  put('lantern', asset('farmstead-lantern'), 1095, 493, 57);
  put('market-flowers', asset('farmstead-pink-pot'), 1060, 497, 35);
  put('market-crate', asset('farmstead-crate'), 840, 489, 37);
  for (const [key, x, feet] of [
    ['farmer', 223, 518],
    ['gardener', 1110, 535],
  ] as const) {
    const source = assets.get(feature(key))!;
    const position = npcPlacement(source, x, feet);
    props.push({ key, source, ...position, depth: feet });
  }

  // Plant in loose groups near buildings, leaving the gate and shop approaches readable.
  for (const [index, [x, y, width]] of [
    [28, 476, 65],
    [108, 479, 38],
    [228, 467, 44],
    [419, 468, 56],
    [447, 506, 45],
    [575, 480, 58],
    [816, 478, 61],
    [1080, 458, 40],
    [1133, 505, 45],
    [1260, 515, 62],
    [39, 549, 45],
    [223, 545, 30],
    [551, 543, 41],
    [785, 540, 35],
    [1020, 543, 35],
  ].entries())
    put(`garden-${index}`, asset(index % 3 ? 'farmstead-daisies' : 'farmstead-flower-rocks'), x, y, width);

  // Low, irregular planting replaces the continuous stone wall in the foreground.
  for (let i = 0; i < 25; i++) {
    const x = i * 55 - 15;
    put(
      `verge-${i}`,
      asset(i % 3 ? 'farmstead-grass-tuft' : 'farmstead-hedge-wide'),
      x,
      691 + (i % 3) * 4,
      65 + (i % 4) * 7,
    );
    if (i % 3 === 1)
      put(`verge-flower-${i}`, asset(i % 2 ? 'farmstead-flower-bush' : 'farmstead-flowers-yellow'), x + 15, 696, 38);
  }
  for (const [index, x] of [190, 378, 830, 1115].entries())
    put(`verge-rock-${index}`, asset('farmstead-rock'), x, 708, 35 + (index % 2) * 7);
  put('front-left-bush', asset('farmstead-daisies'), 15, 746, 180);
  put('front-right-bush', asset('farmstead-flower-rocks'), 1260, 756, 210);
  props.sort((a, b) => a.depth - b.depth);
  return (view: CharacterRenderer, hero: AvatarState, now: number, position: { x: number; y: number }) => {
    view.beginFrame();
    view.surface('entrance-farm-ground', ground, 0, 0, ENTRANCE_SIZE.width, ENTRANCE_SIZE.height);
    let heroDrawn = false;

    const drawHero = () => {
      view.rectangle(
        position.x - 13 * FARM_CHARACTER_SCALE,
        position.y - FARM_CHARACTER_SCALE,
        26 * FARM_CHARACTER_SCALE,
        2 * FARM_CHARACTER_SCALE,
        0x1e320f,
        0.35,
      );
      view.drawPieces(
        'character',
        sheet,
        layoutAvatar(items, sheet, hero.visibleEquip(items), hero.pose, hero.mirror, now),
        position.x,
        position.y,
        FARM_CHARACTER_SCALE,
      );
    };

    for (const prop of props) {
      if (!heroDrawn && prop.depth > position.y) {
        drawHero();
        heroDrawn = true;
      }
      view.surface(`entrance-${prop.key}`, prop.source, prop.x, prop.y, prop.width, prop.height);
    }
    if (!heroDrawn) drawHero();
    for (const target of ENTRANCE_TARGETS) {
      if (!target.arrow) continue;
      const [x, y] = target.arrow;
      drawEntranceHint(view, '', arrow, x, y + 12, now);
    }
    drawAvatarLabel(view, name, hero, position.x, position.y, FARM_CHARACTER_SCALE, true);
    view.endFrame();
  };
}
