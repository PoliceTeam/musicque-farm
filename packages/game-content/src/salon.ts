import type { MapDefinition, MapLayer } from './world.js';

const layers: MapLayer[] = [
  { id: 'ceiling', x: 0, y: 0, width: 1600, height: 1000, depth: -20, color: 0x302f38 },
  { id: 'floor-base', x: 50, y: 250, width: 1500, height: 650, depth: -10, color: 0xbababa },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: `salon:${asset}`, x, y, width, height, depth });
}

for (let y = 280; y < 900; y += 100)
  for (let x = 50; x < 1550; x += 125) prop(`floor-${x}-${y}`, 'floor', x, y, 125, 100, -9);
for (let x = 100; x < 1500; x += 210) prop(`wall-${x}`, 'wall', x, 100, 210, 180, -2);
prop('corner-left', 'corner-left', 0, 100, 135, 184, -1);
prop('corner-right', 'corner-right', 1485, 100, 115, 204, -1);
for (const x of [0, 1550]) prop(`side-${x}`, 'front-wall', x, 280, 50, 620, 0);
for (const x of [300, 1130]) prop(`door-${x}`, 'door', x, 160, 200, (200 * 131) / 157, 300);
prop('painting', 'painting', 690, 135, 220, (220 * 106) / 159, 300);
for (const x of [180, 480, 640, 960, 1100, 1420]) prop(`lamp-${x}`, 'lamp', x, 107, 48, (48 * 67) / 60, 301);
prop('shelf', 'shelf', 70, 290, 130, (130 * 206) / 143);
prop('poster', 'poster', 68, 145, 100, (100 * 105) / 113, 300);
for (const [i, x] of [80, 240, 400].entries()) {
  prop(`mirror-${i}`, 'mirror', x, 430, 130, (130 * 205) / 105);
  prop(`chair-${i}`, 'stool', x + 55, 675, 64, (64 * 120) / 76);
}
// Supplied employee and reception desk use the supplied source module.
layers.push({
  id: 'employee',
  npc: 'salon',
  asset: 'npc:salon',
  x: 750,
  y: 275,
  width: 100,
  height: 130,
  depth: 400,
  shop: 'salon',
  shopInteraction: [800, 570],
});
prop('reception', 'counter-empty', 605, 350, 390, 165, 515);
layers[layers.length - 1].shop = 'salon';
for (const x of [650, 890]) prop(`guest-stool-${x}`, 'stool', x, 510, 60, (60 * 120) / 76);
prop('sofa', 'sofa', 1150, 365, 285, (285 * 104) / 188);
prop('armchair', 'armchair', 1410, 490, 115, (115 * 116) / 98);
prop('coffee-table', 'coffee-table', 1200, 550, 190, (190 * 87) / 136);
prop('cosmetics', 'cosmetics', 1380, 660, 150, (150 * 199) / 134);
for (const [i, x, y] of [
  [0, 1020, 290],
  [1, 1430, 275],
  [2, 550, 800],
  [3, 990, 800],
])
  prop(`plant-${i}`, 'plant', x, y, 110, (110 * 124) / 100, i >= 2 ? 1002 : y + (110 * 124) / 100);
for (let x = 0; x < 650; x += 217) prop(`front-left-${x}`, 'front-wall', x, 860, 217, 140, 1001);
for (let x = 950; x < 1600; x += 217) prop(`front-right-${x}`, 'front-wall', x, 860, 217, 140, 1001);
prop('exit-mat', 'exit-mat', 680, 835, 240, (240 * 108) / 158, -1);

export const salonMap: MapDefinition = {
  id: 'salon',
  regionId: 'center',
  label: 'Mỹ viện',
  scene: 'location',
  presentation: 'interior',
  width: 1600,
  height: 1000,
  channels: { count: 40, capacity: 30 },
  layers,
  systems: [],
  spawn: [800, 810],
  obstacles: [
    { x0: 0, y0: 0, x1: 1600, y1: 305 },
    { x0: 0, y0: 300, x1: 60, y1: 1000 },
    { x0: 1540, y0: 300, x1: 1600, y1: 1000 },
    { x0: 0, y0: 860, x1: 650, y1: 1000 },
    { x0: 950, y0: 860, x1: 1600, y1: 1000 },
    { x0: 605, y0: 425, x1: 995, y1: 515 },
    { x0: 70, y0: 435, x1: 200, y1: 480 },
    ...[80, 240, 400].map((x) => ({ x0: x, y0: 640, x1: x + 135, y1: 685 })),
    { x0: 1150, y0: 480, x1: 1435, y1: 525 },
    { x0: 1200, y0: 635, x1: 1390, y1: 675 },
    { x0: 1380, y0: 825, x1: 1530, y1: 888 },
  ],
  portals: [{ id: 'exit', target: 'shopping-street', spawn: [165, 580], entrance: [800, 915] }],
};
