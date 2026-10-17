import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x293344 },
  { id: 'floor-base', x: 50, y: 280, width: 1500, height: 620, depth: -10, color: 0xb6c3cc },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: `held-shop:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 100)
  for (let x = 50; x < 1550; x += 100) prop(`floor-${x}-${y}`, 'floor', x, y, 100, 100, -9);
for (let x = 50; x < 1550; x += 300) prop(`wall-${x}`, 'wall', x, 100, 300, 180, -2);
prop('door', 'door', 120, 155, 200, 205, 300);
prop('mat', 'mat', 140, 350, 165, 78, -1);
prop('sign', 'sign', 600, 115, 400, 100, 301);
prop('window', 'window', 1200, 150, 150, 95, 301);
prop('clock', 'clock', 1390, 145, 85, 85, 301);
prop('hats-display', 'hats-display', 365, 220, 230, 120, 345);
prop('face-display', 'face-display', 1020, 240, 260, 100, 345);
prop('shelf', 'shelf', 1400, 290, 130, 180);
for (const x of [60, 330, 1300]) prop(`plant-${x}`, 'plant', x, 290, 80, 130);
// Employee, desk and desk accessories remain independent scene objects.
layers.push({
  id: 'employee',
  npc: 'held',
  asset: 'npc:held',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 440,
  shop: 'accessories',
  shopInteraction: [800, 580],
});
prop('counter', 'counter', 575, 395, 450, 125, 520);
layers[layers.length - 1].shop = 'accessories';
prop('desk-plant', 'desk-plant', 585, 345, 65, 90, 525);
prop('book', 'book', 700, 380, 80, 50, 525);
prop('computer', 'computer', 900, 345, 90, 85, 525);
for (const x of [600, 950]) prop(`stool-${x}`, 'stool', x, 530, 70, 90);
for (const [id, x, y, width, height] of [
  ['wands-display', 80, 445, 210, 150],
  ['charms-display', 305, 445, 210, 140],
  ['guitars-display', 1085, 445, 210, 155],
  ['umbrellas-display', 1310, 445, 210, 190],
  ['waterguns-display', 80, 655, 210, 190],
  ['bags-display', 310, 655, 110, 185],
  ['bag-stand', 435, 650, 105, 200],
  ['toys-display', 1085, 665, 210, 180],
  ['flowers-display', 1340, 650, 125, 200],
] as const)
  prop(id, id, x, y, width, height);
for (const x of [0, 1550]) prop(`side-wall-${x}`, 'front-wall', x, 280, 50, 620, 1000);
for (const [id, x] of [
  ['left', 0],
  ['right', 950],
] as const)
  prop(`front-${id}`, 'front-wall', x, 880, 650, 120, 1001);

export const heldShopMap: MapDefinition = {
  id: 'held-shop',
  regionId: 'center',
  label: 'Cửa hàng đồ cầm tay',
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
    { x0: 575, y0: 435, x1: 1025, y1: 525 },
    ...layers
      .filter((layer) =>
        [
          'wands-display',
          'charms-display',
          'guitars-display',
          'umbrellas-display',
          'waterguns-display',
          'bags-display',
          'bag-stand',
          'toys-display',
          'flowers-display',
        ].includes(layer.id),
      )
      .map((layer) => ({ x0: layer.x, y0: layer.y + 40, x1: layer.x + layer.width, y1: layer.y + layer.height })),
    ...[600, 950].map((x) => ({ x0: x, y0: 575, x1: x + 70, y1: 620 })),
  ],
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [445, 580], entrance: [800, 925] }],
};
