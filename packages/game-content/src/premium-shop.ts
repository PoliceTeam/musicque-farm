import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x352740 },
  { id: 'floor-base', x: 50, y: 280, width: 1500, height: 620, depth: -10, color: 0xc7bfb5 },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: `premium-shop:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 100)
  for (let x = 50; x < 1550; x += 100) prop(`floor-${x}-${y}`, 'floor', x, y, 100, 100, -9);
for (let x = 50; x < 1550; x += 250) prop(`wall-${x}`, 'wall', x, 100, 250, 180, -2);
prop('door', 'door', 120, 160, 190, 160, 300);
prop('entrance-mat', 'mat', 115, 320, 200, 88, -1);
prop('sign', 'sign', 560, 110, 480, 120, 301);
for (const x of [430, 1065]) prop(`banner-${x}`, 'banner', x, 110, 100, 110, 301);
for (const x of [60, 320, 1320]) prop(`plant-${x}`, 'plant', x, 285, 75, 115);
prop('crowns-display', 'crowns-display', 355, 245, 150, 125, 375);
prop('wings-display', 'wings-display', 520, 245, 150, 130, 375);
prop('crown-showcase', 'crown-showcase', 720, 225, 160, 150, 380);
prop('hair-display', 'hair-display', 920, 250, 190, 125, 380);
prop('mirror', 'mirror', 1150, 220, 85, 165, 390);
prop('mannequins', 'mannequins', 1250, 170, 265, 235, 405);
// Employee, desk and its accessories remain separate reusable objects.
layers.push({
  id: 'employee',
  npc: 'premium',
  asset: 'npc:premium',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 440,
  shop: 'premium',
  shopInteraction: [800, 580],
});
prop('counter', 'counter', 575, 395, 450, 110, 510);
layers[layers.length - 1].shop = 'premium';
prop('desk-flowers', 'desk-flowers', 585, 347, 65, 85, 515);
prop('book', 'book', 700, 382, 75, 45, 515);
prop('computer', 'computer', 900, 346, 90, 85, 515);
prop('counter-mat', 'mat', 690, 525, 220, 88, -1);
for (const x of [600, 950]) prop(`stool-${x}`, 'stool', x, 530, 70, 88);
for (const [id, x, y, width, height] of [
  ['hats-display', 80, 445, 240, 125],
  ['hairbands-display', 335, 445, 165, 150],
  ['dresses-display', 80, 650, 225, 175],
  ['hairstyles-display', 320, 650, 200, 175],
  ['charms-display', 535, 655, 85, 165],
  ['bags-display', 1000, 655, 90, 170],
  ['accessories-display', 1100, 650, 180, 170],
  ['suits-display', 1295, 650, 225, 170],
  ['wands-display', 1210, 445, 310, 165],
  ['star-display', 1100, 445, 95, 165],
] as const)
  prop(id, id, x, y, width, height);
// Place the jewel display beside the aisle so the front exit stays clear.
prop('gem-showcase', 'gem-showcase', 650, 650, 115, 140);
for (const [i, x] of [635, 920].entries()) prop(`flowers-${i}`, 'flowers', x, 620, 60, 95);
for (const x of [0, 1550]) prop(`side-wall-${x}`, 'front-wall', x, 280, 50, 620, 1000);
for (const [id, x] of [
  ['left', 0],
  ['right', 950],
] as const)
  prop(`front-${id}`, 'front-wall', x, 880, 650, 120, 1001);

export const premiumShopMap: MapDefinition = {
  id: 'premium-shop',
  regionId: 'center',
  label: 'Cửa hàng cao cấp',
  scene: 'location',
  presentation: 'interior',
  width: 1600,
  height: 1000,
  channels: { count: 40, capacity: 30 },
  layers,
  systems: [],
  spawn: [800, 815],
  obstacles: [
    { x0: 0, y0: 0, x1: 1600, y1: 310 },
    { x0: 0, y0: 300, x1: 60, y1: 1000 },
    { x0: 1540, y0: 300, x1: 1600, y1: 1000 },
    { x0: 0, y0: 880, x1: 650, y1: 1000 },
    { x0: 950, y0: 880, x1: 1600, y1: 1000 },
    { x0: 575, y0: 435, x1: 1025, y1: 510 },
    ...layers
      .filter((layer) =>
        [
          'hats-display',
          'hairbands-display',
          'dresses-display',
          'hairstyles-display',
          'charms-display',
          'bags-display',
          'accessories-display',
          'suits-display',
          'wands-display',
          'star-display',
          'gem-showcase',
        ].includes(layer.id),
      )
      .map((layer) => ({ x0: layer.x, y0: layer.y + 40, x1: layer.x + layer.width, y1: layer.y + layer.height })),
    ...[600, 950].map((x) => ({ x0: x, y0: 575, x1: x + 70, y1: 618 })),
  ],
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [1205, 580], entrance: [800, 925] }],
};
