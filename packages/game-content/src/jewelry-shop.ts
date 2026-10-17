import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x34273d },
  { id: 'floor-base', x: 50, y: 280, width: 1500, height: 620, depth: -10, color: 0xcac3ba },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: asset.includes(':') ? asset : `jewelry-shop:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 100)
  for (let x = 50; x < 1550; x += 100) prop(`floor-${x}-${y}`, 'jewelry-shop:floor', x, y, 100, 100, -9);
for (let x = 50; x < 1550; x += 300) prop(`wall-${x}`, 'wall', x, 100, 300, 180, -2);
prop('sign', 'sign', 565, 115, 470, 140);
prop('door', 'door', 125, 160, 190, 145);
prop('entrance-mat', 'mat', 120, 310, 200, 85);
prop('banner-left', 'banner', 415, 115, 90, 160);
prop('banner-right', 'banner', 1095, 115, 90, 160);
prop('gem-showcase', 'gem-showcase', 710, 240, 180, 140);
prop('rings-display', 'rings-display', 350, 235, 180, 155);
prop('crowns-display', 'crowns-display', 535, 235, 160, 140);
prop('mirror', 'mirror', 1250, 235, 110, 170);
prop('pedestal', 'pedestal', 1390, 265, 85, 135);
prop('amulets-display', 'amulets-display', 80, 460, 240, 200);
prop('stones-display', 'stones-display', 335, 460, 190, 170);
prop('colors-display', 'colors-display', 1085, 460, 190, 185);
prop('hearts-display', 'hearts-display', 1290, 460, 200, 185);
prop('gems-display', 'gems-display', 110, 690, 220, 175);
prop('rings-front', 'rings-display', 350, 690, 180, 170);
prop('stones-front', 'stones-display', 1085, 690, 200, 170);
prop('colors-front', 'colors-display', 1300, 690, 195, 170);
for (const x of [60, 325, 1350]) prop(`plant-${x}`, 'plant', x, 295, 75, 115);
layers.push({
  id: 'employee',
  npc: 'jewelry',
  asset: 'npc:jewelry',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 440,
  shop: 'jewelry',
  shopInteraction: [800, 580],
});
prop('counter', 'counter', 575, 395, 450, 115, 515);
layers[layers.length - 1].shop = 'jewelry';
prop('desk-computer', 'computer', 895, 347, 90, 85, 520);
prop('desk-flowers', 'flowers', 585, 345, 70, 85, 520);
for (const x of [600, 950]) prop(`stool-${x}`, 'stool', x, 530, 70, 90);
for (const x of [0, 1550]) prop(`side-${x}`, 'front-wall', x, 280, 50, 620, 1000);
for (const [id, x] of [
  ['left', 0],
  ['right', 950],
] as const)
  prop(`front-${id}`, 'front-wall', x, 880, 650, 120, 1001);

export const jewelryShopMap: MapDefinition = {
  id: 'jewelry-shop',
  regionId: 'center',
  label: 'Cửa hàng đá quý',
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
    { x0: 575, y0: 435, x1: 1025, y1: 515 },
    ...layers
      .filter((l) => l.y >= 450 && l.y < 850 && !l.id.startsWith('floor-') && !l.id.startsWith('stool-'))
      .map((l) => ({ x0: l.x, y0: l.y + 40, x1: l.x + l.width, y1: l.y + l.height })),
    ...[600, 950].map((x) => ({ x0: x, y0: 575, x1: x + 70, y1: 620 })),
  ],
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [1500, 580], entrance: [800, 925] }],
};
