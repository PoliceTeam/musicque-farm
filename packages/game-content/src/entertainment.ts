import type { MapDefinition, MapLayer } from './world.js';

// Reference layout: six storefronts, a planted shop border, pedestrian plaza and road.
const layers: MapLayer[] = [
  { id: 'sky-color', color: 0x4fbdf1, x: 0, y: 0, width: 1680, height: 940, depth: -20 },
  { id: 'paving-color', color: 0xb8b5ac, x: 0, y: 520, width: 1680, height: 310, depth: -1 },
  { id: 'road-color', color: 0x393b3c, x: 0, y: 830, width: 1680, height: 110, depth: 0 },
];

function prop(id: string, asset: string, x: number, y: number, width: number, height: number, depth = y + height) {
  layers.push({ id, asset: `entertainment:${asset}`, x, y, width, height, depth });
}

prop('sky', 'sky', 0, 0, 1680, 520, -10);
for (const [index, x] of [-30, 545, 1120].entries())
  prop(`skyline-${index}`, 'skyline', x, 270, 630, (630 * 101) / 265, -8);
for (const [index, x, y, width] of [
  [0, 70, 100, 260],
  [1, 470, 220, 190],
  [2, 880, 80, 230],
  [3, 1270, 190, 290],
]) {
  prop(`cloud-${index}`, 'cloud', x, y, width, (width * 72) / 175, -9);
  layers[layers.length - 1].drift = { distance: 32 + index * 7, seconds: 100 + index * 15 };
}
prop('plaza', 'plaza', 0, 520, 1680, 310, 0);
for (let x = 0; x < 1680; x += 120) {
  prop(`road-${x}`, 'road', x, 830, 120, 110, 1);
  prop(`curb-${x}`, 'curb', x, 819, 120, 26, 2);
}
for (const x of [185, 740, 1270])
  layers.push({ id: `lane-${x}`, color: 0xe6e5dc, x, y: 878, width: 210, height: 15, depth: 2 });
for (const [i, x] of [-80, 120, 490, 850, 1100, 1570].entries()) {
  const height = i % 2 ? 206 : 219;
  prop(`back-tree-${i}`, i % 2 ? 'tree-alt' : 'tree', x, 539 - height, i % 2 ? 170 : 240, height, 530);
}
prop('pole-left', 'utility-pole', 294, 102, 43, 440, 531);
prop('pole-right', 'utility-pole', 1194, 102, 43, 440, 531);
prop('wires', 'wires', 0, 147, 1680, 80, 532);
prop('garden', 'garden', 0, 495, 1680, 65, 529);
// Keep the original aspect ratios rather than stretching architecture.
prop('atm', 'atm', 55, 365, 185, 178, 545);
prop('arcade', 'arcade', 350, 327, 205, 217.5, 545);
prop('hall', 'hall', 686, 299, 225, (225 * 234) / 217, 545);
prop('auction', 'auction', 992, 376, 195, 165.5, 545);
prop('prizes', 'prizes', 1210, 407, 195, 136, 547);
// Disc sits behind the fixed roof; its wooden booth and triangular support remain fixed.
prop('wheel-base', 'wheel-base', 1224, 395, 166, 30, 545);
prop('wheel-disc', 'wheel-disc', 1267, 315, 92, 92.75, 546);
layers[layers.length - 1].rotationSeconds = 16;
prop('wheel-pointer', 'wheel-pointer', 1300, 301, 26, 38, 548);
prop('racing', 'racing', 1410, 372, 260, 148.7, 545);
for (let x = 0; x < 1680; x += 84) {
  const shrub = x % 168 === 0;
  const width = shrub ? 60 : 76;
  const height = shrub ? (width * 46) / 51 : (width * 61) / 84;
  prop(`shop-border-${x}`, shrub ? 'shrubs' : 'flower-patch', x - 10, 550 - height, width, height, 549);
}
prop('billboard', 'billboard', 610, 608, 370, (370 * 152) / 369);
for (const [index, x] of [260, 610, 943, 1184].entries()) {
  prop(`shop-evergreen-${index}`, 'evergreen', x - 15, 412, 65, 115, 548);
  prop(`shop-flowers-${index}`, 'flower-patch', x - 35, 500, 90, 43, 550);
}
for (const x of [292, 1104]) {
  prop(`lamp-${x}`, 'lamp', x, 572, 57, 244);
  prop(`flowers-${x}`, 'flower-patch', x - 60, 768, 110, 54);
}
for (const [index, x] of [185, 500, 995, 1510].entries()) {
  prop(`front-evergreen-${index}`, 'evergreen', x, 655 + (index % 2) * 12, 80, 145 - (index % 2) * 12);
  prop(`front-flowers-${index}`, 'flower-patch', x - 34, 756, 112, 55);
}
prop('bin', 'bin', 18, 757, 45, 70);
// Preserve the source 64:114 aspect ratio; keep the base on the sidewalk.
prop('zone-sign', 'zone-sign', 88, 663, 86, (86 * 114) / 64);
prop('hydrant', 'hydrant', 1180, 755, 45, 68);
for (const x of [470, 1150]) prop(`drain-${x}`, 'drain', x, 816, 84, 25, 846);
layers.find((layer) => layer.id === 'arcade')!.destination = { regionId: 'fun', mapId: 'arcade-hall' };
const entrances: Record<string, readonly [number, number]> = {
  atm: [145, 545],
  arcade: [455, 545],
  hall: [799, 545],
  auction: [1090, 545],
  prizes: [1307, 545],
  racing: [1540, 523],
};
for (const layer of layers) if (entrances[layer.id]) layer.entrance = entrances[layer.id];

export const entertainmentMap: MapDefinition = {
  scene: 'location',
  channels: { count: 40, capacity: 30 },
  id: 'entertainment-street',
  regionId: 'fun',
  label: 'Phố giải trí',
  width: 1680,
  height: 940,
  layers,
  systems: [],
  spawn: [800, 780],
  obstacles: [
    { x0: 0, y0: 0, x1: 1680, y1: 550 },
    { x0: 0, y0: 829, x1: 1680, y1: 940 },
    { x0: 610, y0: 737, x1: 980, y1: 762 },
    ...[292, 1104].map((x) => ({ x0: x, y0: 801, x1: x + 57, y1: 817 })),
  ],
  portals: [{ id: 'exit', target: 'world', spawn: [405, 425], entrance: [800, 823] }],
};
