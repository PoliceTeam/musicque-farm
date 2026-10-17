import type { MapDefinition, MapLayer } from './world.js';

const width = 2080;
const layers: MapLayer[] = [
  { id: 'sky-color', color: 0x4fbdf1, x: 0, y: 0, width, height: 940, depth: -20 },
  { id: 'paving-color', color: 0xb8b5ac, x: 0, y: 520, width, height: 310, depth: -1 },
  { id: 'road-color', color: 0x393b3c, x: 0, y: 830, width, height: 110, depth: 0 },
];

function prop(id: string, asset: string, x: number, y: number, w: number, h: number, depth = y + h) {
  layers.push({ id, asset, x, y, width: w, height: h, depth });
}

prop('sky', 'entertainment:sky', 0, 0, width, 520, -10);
for (const [i, x] of [-40, 530, 1100, 1670].entries())
  prop(`skyline-${i}`, 'scenery:skyline', x, 215, 630, (630 * 101) / 265, -8);
for (const [i, x, y, w] of [
  [0, 90, 110, 250],
  [1, 630, 170, 210],
  [2, 1220, 90, 260],
  [3, 1750, 185, 240],
]) {
  prop(`cloud-${i}`, 'scenery:cloud', x, y, w, (w * 72) / 175, -9);
  layers[layers.length - 1].drift = { distance: 30, seconds: 110 + i * 13 };
}
prop('plaza', 'entertainment:plaza', 0, 520, width, 310, 0);
for (let x = 0; x < width; x += 120) {
  prop(`road-${x}`, 'scenery:road', x, 830, 120, 110, 1);
  prop(`curb-${x}`, 'scenery:curb', x, 819, 120, 26, 2);
}
for (const x of [170, 700, 1230, 1760])
  layers.push({ id: `lane-${x}`, color: 0xe6e5dc, x, y: 878, width: 210, height: 15, depth: 2 });
for (const [i, x] of [-70, 230, 580, 900, 1250, 1550, 1880].entries())
  prop(
    `back-tree-${i}`,
    i % 2 ? 'scenery:autumn-tree-red' : 'scenery:autumn-tree',
    x,
    225,
    i % 2 ? (320 * 136) / 175 : (320 * 189) / 214,
    320,
    530,
  );
prop('garden', 'entertainment:garden', 0, 495, width, 65, 529);

// Dimensions retain each supplied storefront's aspect ratio, with all doors on the same ground line.
for (const [id, x, w, sourceW, sourceH] of [
  ['salon', 40, 245, 455, 419],
  ['gifts', 315, 265, 509, 423],
  ['pets', 800, 255, 518, 368],
  ['premium', 1080, 265, 508, 442],
  ['jewelry', 1370, 265, 498, 363],
  ['fashion', 1670, 320, 482, 334],
] as const) {
  const h = (w * sourceH) / sourceW;
  prop(id, `shopping:${id}`, x, 545 - h, w, h, 545);
  layers[layers.length - 1].entrance = [x + w / 2, 545];
}
prop('atm', 'scenery:atm', 610, 391.5, 160, 153.5, 545);
layers[layers.length - 1].entrance = [690, 545];
for (let x = 0; x < width; x += 80) prop(`shop-border-${x}`, 'scenery:flower-patch', x - 8, 515, 76, 40, 549);
for (const [i, x] of [290, 590, 785, 1060, 1350, 1645, 2000].entries())
  prop(`shop-evergreen-${i}`, 'scenery:shrubs', x - 20, 502, 52, 47, 550);

// Center the shelter itself; its detached sign does not shift the roof's visual center.
prop('bus-stop', 'scenery:bus-stop', width / 2 - 150, 605, 300, (300 * 134) / 250);
prop('bus-stop-sign', 'scenery:bus-stop-sign', 1212, 605, (300 * 64) / 250, (300 * 134) / 250);
for (const [i, x] of [115, 460, 1630, 1870].entries()) {
  prop(`bench-${i}`, 'scenery:bench', x, 683, 145, (145 * 70) / 113);
  prop(`bench-flowers-${i}`, 'scenery:flower-patch', x - 12, 761, 165, 47, 810);
}
for (const [i, x] of [62, 770, 1575, 2020].entries()) prop(`lamp-${i}`, 'scenery:lamp', x, 568, 54, 241);
for (const [i, x] of [310, 650, 1330, 1775].entries()) prop(`lotus-${i}`, 'scenery:lotus', x, 749, 77, (77 * 73) / 84);
prop('zone-sign', 'scenery:zone-sign', 1460, 663, 78, (78 * 114) / 64);
prop('bin', 'scenery:bin', 24, 752, 43, 68);
for (const x of [465, 1380, 1950]) prop(`drain-${x}`, 'scenery:drain', x, 816, 84, 25, 846);

export const shoppingMap: MapDefinition = {
  id: 'shopping-street',
  regionId: 'center',
  label: 'Khu mua sắm',
  scene: 'location',
  presentation: 'street',
  channels: { count: 40, capacity: 30 },
  width,
  height: 940,
  layers,
  systems: [],
  spawn: [780, 780],
  obstacles: [
    { x0: 0, y0: 0, x1: width, y1: 550 },
    { x0: 0, y0: 829, x1: width, y1: 940 },
    { x0: 890, y0: 749, x1: 1190, y1: 771 },
    { x0: 1238, y0: 758, x1: 1263, y1: 771 },
    ...[115, 460, 1630, 1870].map((x) => ({ x0: x, y0: 752, x1: x + 145, y1: 779 })),
  ],
  portals: [{ id: 'exit', target: 'world', spawn: [780, 580], entrance: [1040, 823] }],
};
