import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x343044 },
  { id: 'floor-base', x: 50, y: 280, width: 1500, height: 620, depth: -10, color: 0xa6bfd0 },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: `pet-shop:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 140)
  for (let x = 50; x < 1550; x += 100) prop(`floor-${x}-${y}`, 'floor', x, y, 100, 140, -9);
for (let x = 50; x < 1550; x += 300) prop(`wall-${x}`, 'wall', x, 100, 300, 180, -2);
prop('door', 'door', 155, 120, 225, 235, 300);
prop('mat', 'mat', 175, 340, 180, 78, -1);
prop('window', 'window', 475, 165, 180, 95, 300);
prop('clock', 'clock', 800, 115, 90, 100, 300);
prop('painting', 'painting', 1100, 150, 190, 130, 300);
prop('shelf', 'shelf', 1350, 250, 125, 160);
prop('phone-shelf', 'phone-shelf', 760, 250, 90, 165);
for (const x of [410, 1000, 1450]) prop(`plant-${x}`, 'plant', x, 270, 95, 145);
// An existing approved character preset is a separate NPC, never baked into the desk.
layers.push({
  id: 'employee',
  npc: 'pets',
  asset: 'npc:pets',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 440,
  shop: 'pets',
  shopInteraction: [800, 580],
});
prop('counter', 'counter', 575, 395, 450, 115, 510);
layers[layers.length - 1].shop = 'pets';
prop('desk-plant', 'desk-plant', 585, 355, 70, 80, 515);
prop('book', 'book', 680, 380, 80, 55, 515);
prop('computer', 'computer', 900, 352, 90, 85, 515);
for (const x of [600, 950]) prop(`stool-${x}`, 'stool', x, 515, 70, 90);
// Supplied populated cages preserve their original pet placement and proportions.
for (const [id, x, y, height] of [
  ['left-top', 80, 440, (425 * 193) / 434],
  ['left-bottom', 80, 650, (425 * 207) / 478],
  ['right-top', 1095, 440, (425 * 193) / 490],
  ['right-bottom', 1095, 650, (425 * 207) / 490],
] as const)
  prop(`cages-${id}`, `cage-display-${id}`, x, y, 425, height);
for (const x of [0, 1550]) prop(`side-wall-${x}`, 'front-wall', x, 280, 50, 620, 1000);
for (const [id, x] of [
  ['left', 0],
  ['right', 950],
] as const)
  prop(`front-${id}`, 'front-wall', x, 880, 650, 120, 1001);

export const petShopMap: MapDefinition = {
  id: 'pet-shop',
  regionId: 'center',
  label: 'Cửa hàng thú cưng',
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
      .filter((layer) => layer.id.startsWith('cages-'))
      .map((layer) => ({ x0: layer.x, y0: layer.y + 60, x1: layer.x + layer.width, y1: layer.y + layer.height })),
    ...[600, 950].map((x) => ({ x0: x, y0: 560, x1: x + 70, y1: 605 })),
  ],
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [925, 580], entrance: [800, 925] }],
};
