import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x34273d },
  { id: 'floor-base', x: 50, y: 280, width: 1500, height: 620, depth: -10, color: 0xcac3ba },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: asset.includes(':') ? asset : `fashion-shop:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 100)
  for (let x = 50; x < 1550; x += 100) prop(`floor-${x}-${y}`, 'held-shop:floor', x, y, 100, 100, -9);
for (let x = 50; x < 1550; x += 300) prop(`wall-${x}`, 'wall', x, 100, 300, 180, -2);
prop('sign', 'sign', 555, 120, 490, 100);
prop('door', 'door', 125, 160, 205, 155);
prop('entrance-mat', 'mat', 125, 320, 200, 75);
prop('banner-left', 'banner', 415, 110, 95, 140);
prop('banner-right', 'banner', 1085, 110, 95, 140);
prop('frame', 'frame', 1270, 150, 95, 120);
prop('mirror', 'mirror', 1400, 225, 100, 155);
prop('hats-display', 'hats-display', 350, 235, 170, 175);
prop('hair-display', 'hair-display', 535, 235, 150, 180);
prop('lamp', 'lamp', 1190, 115, 320, 65);
prop('dresses-display', 'dresses-display', 80, 460, 230, 190);
prop('bags-display', 'bags-display', 325, 460, 190, 200);
prop('accessories-display', 'accessories-display', 1085, 460, 160, 200);
prop('bottles-display', 'bottles-display', 1260, 460, 230, 200);
prop('hats-front', 'hats-display', 80, 700, 215, 175);
prop('hair-front', 'hair-display', 310, 700, 185, 175);
prop('dresses-front', 'dresses-display', 1085, 705, 220, 165);
prop('bags-front', 'bags-display', 1320, 705, 180, 165);
for (const x of [60, 325, 1350]) prop(`plant-${x}`, 'plant', x, 295, 75, 115);
layers.push({
  id: 'employee',
  npc: 'store',
  asset: 'npc:store',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 440,
  shop: 'fashion',
  shopInteraction: [800, 580],
});
prop('counter', 'counter', 575, 395, 450, 115, 515);
layers[layers.length - 1].shop = 'fashion';
prop('desk-computer', 'computer', 895, 347, 90, 85, 520);
prop('desk-flowers', 'flowers', 585, 345, 70, 85, 520);
for (const x of [600, 950]) prop(`stool-${x}`, 'stool', x, 530, 70, 90);
for (const x of [0, 1550]) prop(`side-${x}`, 'front-wall', x, 280, 50, 620, 1000);
for (const [id, x] of [
  ['left', 0],
  ['right', 950],
] as const)
  prop(`front-${id}`, 'front-wall', x, 880, 650, 120, 1001);

export const fashionShopMap: MapDefinition = {
  id: 'fashion-shop',
  regionId: 'center',
  label: 'Cửa hàng',
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
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [1830, 580], entrance: [800, 925] }],
};
