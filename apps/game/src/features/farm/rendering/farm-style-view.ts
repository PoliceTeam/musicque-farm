import { seededRandom } from '@chibi-town/character-core/random';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { cropStage, type FarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmEggBaskets } from '@chibi-town/gameplay/farm-egg-logic';
import { farmFoodPercent } from '@chibi-town/gameplay/farm-feeding-logic';
import { farmLayoutSignature } from '@chibi-town/gameplay/farm-layout-logic';
import { FARM_UNIT_LIMITS } from '@chibi-town/gameplay/farm-unit-logic';
import { CROP_GROWTH_FRAMES, cropAssetName, cropGrowthFrame } from '@/features/farm/_utils/crop-growth-frames';
import {
  FARM_EGG_BASKET_SPOTS,
  FARM_EXIT,
  FARM_LAWNS,
  FARM_PLOTS,
  FARM_WORLD,
  type FarmUnitLevels,
  farmFeaturesFor,
} from '@/features/farm/_utils/farm-layout';
import { createFarmAnimalMotion } from '@/features/farm/rendering/farm-animal-view';
import { createFarmCropFrames, createFarmPlantFrame } from '@/features/farm/rendering/farm-crop-view';
import { createFarmPondMotion } from '@/features/farm/rendering/farm-pond-view';
import { farmSceneAssetLoader, loadFarmSceneAssets } from '@/features/farm/rendering/farm-scene-assets';
import { createEntranceHint } from '@/game/rendering/entrance-hint';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export async function farmStyleScenery(
  progress: FarmProgress,
  levels: FarmUnitLevels,
  labels = { enter: '→', exit: '←' },
) {
  const images = await loadFarmSceneAssets();

  const asset = farmSceneAssetLoader(images);

  const ground = canvas(FARM_WORLD.width, FARM_WORLD.height),
    g = ground.getContext('2d')!;
  const random = seededRandom(421);
  const sand = g.createLinearGradient(0, 150, 0, 720);
  sand.addColorStop(0, '#bc995f');
  sand.addColorStop(0.45, '#d5b176');
  sand.addColorStop(1, '#d9b77c');
  g.fillStyle = sand;
  g.fillRect(0, 0, 1280, 720);
  const beds = FARM_LAWNS;
  // Broad, translucent earth patches give paths variation without competing with sprites.
  for (let i = 0; i < 90; i++) {
    const x = random() * 1280,
      y = 170 + random() * 550,
      radius = 20 + random() * 55;
    const patch = g.createRadialGradient(x, y, 0, x, y, radius);
    patch.addColorStop(0, i % 3 ? '#f2d8a51c' : '#8e68391a');
    patch.addColorStop(1, '#cda66b00');
    g.fillStyle = patch;
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (const [x, y, w, h] of beds) {
    // Sample a rounded perimeter with small organic deviations, rather than a flat slab rim.
    const edge = new Path2D();
    const perimeter: [number, number][] = [];
    const corner = 17;
    for (const [cx, cy, start] of [
      [x + w - corner, y + corner, -Math.PI / 2],
      [x + w - corner, y + h - corner, 0],
      [x + corner, y + h - corner, Math.PI / 2],
      [x + corner, y + corner, Math.PI],
    ]) {
      for (let step = 0; step <= 6; step++) {
        const angle = start + (step * Math.PI) / 12;
        perimeter.push([cx + Math.cos(angle) * corner, cy + Math.sin(angle) * corner]);
      }
    }
    const points: [number, number][] = [];
    perimeter.forEach(([px, py], i) => {
      const [nx, ny] = perimeter[(i + 1) % perimeter.length];
      const length = Math.hypot(nx - px, ny - py);
      const count = Math.max(1, Math.ceil(length / 5));
      for (let j = 0; j < count; j++) {
        const t = j / count,
          wave = (random() - 0.5) * 3;
        points.push([
          px + (nx - px) * t - ((ny - py) / length) * wave,
          py + (ny - py) * t + ((nx - px) / length) * wave,
        ]);
      }
    });
    points.forEach(([px, py], i) => {
      if (i) edge.lineTo(px, py);
      else edge.moveTo(px, py);
    });
    edge.closePath();
    g.strokeStyle = '#a08d4f55';
    g.lineWidth = 5;
    g.stroke(edge);
    g.fillStyle = '#85ad45';
    g.fill(edge);
    g.save();
    g.clip(edge);
    g.globalAlpha = 0.32;
    const textures = ['terrain-grass-a', 'terrain-grass-b', 'terrain-grass-c'].map((name) => {
      const tile = asset(name),
        c = canvas(32, 32),
        cg = c.getContext('2d')!;
      cg.drawImage(tile, 10, 10, tile.width - 20, tile.height - 20, 0, 0, 32, 32);
      const fade = cg.createRadialGradient(16, 16, 7, 16, 16, 17);
      fade.addColorStop(0, '#ffffff');
      fade.addColorStop(1, '#ffffff00');
      cg.globalCompositeOperation = 'destination-in';
      cg.fillStyle = fade;
      cg.fillRect(0, 0, 32, 32);
      return c;
    });
    for (let ty = y - 8; ty < y + h; ty += 17)
      for (let tx = x - 8; tx < x + w; tx += 17) {
        g.drawImage(textures[Math.floor(random() * 3)], tx + random() * 8, ty + random() * 8);
      }
    g.globalAlpha = 1;
    for (let i = 0; i < 18; i++) {
      const cx = x + random() * w,
        cy = y + random() * h,
        radius = 15 + random() * 37;
      const tint = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
      tint.addColorStop(0, i % 3 ? '#bccc642b' : '#456f3724');
      tint.addColorStop(1, '#85ad4500');
      g.fillStyle = tint;
      g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    // The worn verge blends inward, rather than outlining each bed with a dark rim.
    g.strokeStyle = '#c5bc7530';
    g.lineWidth = 9;
    g.stroke(edge);
    g.restore();
    // Tiny uneven grass clusters break the soil boundary; keep them below interactive props.
    for (let i = 0; i < points.length; i += 3) {
      const [px, py] = points[i];
      g.fillStyle = i % 2 ? '#9ebd59' : '#779e40';
      g.fillRect(Math.round(px), Math.round(py) - 2, 2, 3);
      if (random() > 0.45) {
        g.fillStyle = '#b9cc6b55';
        g.fillRect(Math.round(px) + 2, Math.round(py) - 1, 1, 2);
      }
    }
  }
  g.fillStyle = '#85ad45';
  g.fillRect(0, 0, 1280, 172);
  g.fillRect(0, 688, 574, 32);
  g.fillRect(704, 688, 576, 32);
  for (let i = 0; i < 16000; i++) {
    const x = random() * 1280,
      y = 145 + random() * 575;
    const grass =
      beds.some(([bx, by, bw, bh]) => x > bx + 7 && x < bx + bw - 7 && y > by + 7 && y < by + bh - 7) ||
      (y > 690 && (x < 574 || x > 704));
    g.fillStyle = grass ? (i % 3 ? '#b5ce6b30' : '#547e3824') : '#c6945144';
    g.fillRect(x, y, grass ? 1 : 2, grass ? 2 : 1);
  }
  // Soft tree shade along the back fence ties the canopy into the lawn.
  for (let i = 0; i < 15; i++) {
    const cx = i * 91,
      shade = g.createRadialGradient(cx, 169, 3, cx, 169, 57);
    shade.addColorStop(0, '#304b3628');
    shade.addColorStop(1, '#304b3600');
    g.fillStyle = shade;
    g.fillRect(cx - 57, 130, 114, 96);
  }
  // Gravel is concentrated at path margins, leaving the walking lane readable.
  for (let i = 0; i < 350; i++) {
    const x = random() * 1280,
      y = 190 + random() * 480;
    const nearEdge = beds.some(
      ([bx, by, bw, bh]) =>
        x > bx - 10 &&
        x < bx + bw + 10 &&
        y > by - 10 &&
        y < by + bh + 10 &&
        !(x > bx && x < bx + bw && y > by && y < by + bh),
    );
    if (!nearEdge) continue;
    g.fillStyle = '#967b5155';
    g.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(random() * 2), 2);
    g.fillStyle = '#efdab180';
    g.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
  const sky = g.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#142953');
  sky.addColorStop(1, '#637e91');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1280, 130);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = '#d7e5c799';
    g.fillRect(random() * 1280, random() * 90, 1, 1);
  }
  const surfaces = [{ key: 'farm-v11-ground', source: ground, x: 0, y: 0, width: 1280, height: 720, depth: -1 }];
  let generation = '';
  const entranceMarkers: { surface: (typeof surfaces)[number]; y: number; phase: number }[] = [];

  function put(key: string, source: HTMLCanvasElement, x: number, y: number, w: number, h: number, depth = y + h) {
    surfaces.push({ key: `v5-${generation}-${key}`, source, x, y, width: w, height: h, depth });
  }

  function object(key: string, name: string, x: number, baseline: number, width: number) {
    const source = asset(name),
      h = (width * source.height) / source.width;
    put(key, source, x - width / 2, baseline - h, width, h, baseline);
  }

  function rail(key: string, x0: number, x1: number, y: number) {
    const count = Math.ceil((x1 - x0) / 62),
      w = (x1 - x0) / count;
    for (let i = 0; i < count; i++) put(`${key}-${i}`, asset('fence-horizontal-alt'), x0 + i * w, y - 28, w, 28, y);
  }

  function lamp(key: string, x: number, y: number) {
    object(key, 'lantern', x, y, 42);
  }

  const eggEntries: { species: 'hen' | 'duck'; surface: (typeof surfaces)[number] }[] = [];
  let feedEntry: (typeof surfaces)[number] | undefined;
  const feedFrames = [0, 1, 2].map((amount) => {
    const source = asset('feed-trough'),
      c = canvas(source.width, source.height),
      cg = c.getContext('2d')!;
    cg.drawImage(source, 0, 0);
    cg.fillStyle = '#68462b';
    cg.beginPath();
    cg.moveTo(8, 10);
    cg.lineTo(65, 10);
    cg.lineTo(68, 23);
    cg.lineTo(7, 23);
    cg.closePath();
    cg.fill();
    for (let i = 0; i < amount * 14; i++) {
      cg.fillStyle = i % 3 ? '#d7aa45' : '#8b983c';
      cg.fillRect(11 + ((i * 17) % 53), 12 + ((i * 7) % 10), 3, 2);
    }
    return c;
  });
  const motionStart = Date.now();
  let herdSignature = '';
  let pondMotion: ReturnType<typeof createFarmPondMotion> | undefined;
  let freeMotion: ReturnType<typeof createFarmAnimalMotion> | undefined;
  let animalMotion: ReturnType<typeof createFarmAnimalMotion> | undefined;
  let fieldStart = 0,
    layoutSignature = '',
    cropSignature = '';

  function rebuild() {
    generation = `${levels.livestock}-${levels.pond}`;
    surfaces.splice(1);
    entranceMarkers.length = 0;
    eggEntries.length = 0;

    const trees = ['tree-yellow', 'tree-orange', 'tree-green', 'tree-pink'];
    for (let i = 0; i < 15; i++)
      object(`rear-tree-${i}`, trees[(i * 3) % 4], i * 91 - 5, 159 + (i % 3) * 8, 112 + (i % 4) * 11);
    for (let i = 0; i < 25; i++) {
      object(`rear-bush-${i}`, i % 2 ? 'decor-bush-gold' : 'decor-bush-green', i * 53, 174, 35);
      object(`rear-flower-${i}`, i % 2 ? 'decor-flowers-white' : 'decor-flowers-orange', i * 53 + 20, 181, 32);
    }
    rail('rear-fence', 15, 1260, 187);
    for (let i = 0; i < 28; i++) {
      const x = 18 + i * 46;
      if (x > 560 && x < 718) continue;
      object(`front-flower-${i}`, i % 2 ? 'decor-flowers-white' : 'decor-flowers-orange', x, 686, 48);
      put(`front-wall-${i}`, asset('wall-stone-a'), x - 23, 686, 47, 18, 706);
    }
    object('entry-gate', 'entry-gate', 639, 719, 170);
    for (const [i, x] of [15, 130, 1165, 1260].entries()) object(`front-tree-${i}`, trees[i], x, 815, 145);
    const features = farmFeaturesFor(levels);
    for (const id of ['kitchen', 'store']) {
      const f = features.find((f) => f.id === id)!;
      object(
        id,
        id === 'store' ? 'warehouse' : 'kitchen',
        (f.area.x0 + f.area.x1) / 2,
        f.area.y1,
        f.area.x1 - f.area.x0,
      );
    }
    for (const [phase, id] of ['kitchen', 'store', 'exit'].entries()) {
      const f = features.find((f) => f.id === id);
      const x = f ? f.stand[0] : FARM_EXIT.hint[0],
        y = f ? f.area.y1 - 7 : FARM_EXIT.hint[1];
      put(
        `${id}-entrance-v17`,
        createEntranceHint(id === 'exit' ? labels.exit : labels.enter),
        x - 21,
        y,
        42,
        32,
        1000,
      );
      entranceMarkers.push({ surface: surfaces.at(-1)!, y, phase });
    }
    object('store-supplies', 'hay', 499, 271, 35);
    for (let i = 0; i < 5; i++) object(`building-flower-${i}`, 'decor-flowers-mixed', 367 + i * 40, 285, 27);
    object('building-front-flower-left', 'decor-flowers-white-low', 365, 365, 28);
    object('building-front-flower-right', 'decor-flowers-orange-low', 530, 365, 28);
    const a = features.find((f) => f.id === 'livestock')!.area,
      w = a.x1 - a.x0,
      h = a.y1 - a.y0;
    const floor = canvas(w, h),
      fg = floor.getContext('2d')!;
    const penEarth = fg.createLinearGradient(0, 0, w, h);
    penEarth.addColorStop(0, '#b29a64');
    penEarth.addColorStop(0.55, '#bca16b');
    penEarth.addColorStop(1, '#b89b64');
    fg.fillStyle = penEarth;
    fg.beginPath();
    fg.roundRect(0, 0, w, h, 14);
    fg.fill();
    for (let i = 0; i < 500; i++) {
      fg.fillStyle = i % 2 ? '#cfb273' : '#a48b57';
      fg.fillRect(random() * w, random() * h, 2, 1);
    }
    // Local wear beneath feeding fixtures and at the gate, faded into the earth.
    for (const [cx, cy, radius] of [
      [w * 0.59, 78, 43],
      [w - 15, 390 - a.y0, 48],
      [w - 43, h - 25, 30],
    ]) {
      const wear = fg.createRadialGradient(cx, cy, 2, cx, cy, radius);
      wear.addColorStop(0, '#76613f38');
      wear.addColorStop(1, '#76613f00');
      fg.fillStyle = wear;
      fg.fillRect(
        Math.max(0, cx - radius),
        Math.max(0, cy - radius),
        Math.min(w, cx + radius) - Math.max(0, cx - radius),
        Math.min(h, cy + radius) - Math.max(0, cy - radius),
      );
    }
    fg.fillStyle = '#a38b5a22';
    for (let i = 0; i < 16; i++) {
      fg.beginPath();
      fg.ellipse(
        25 + random() * (w - 50),
        90 + random() * (h - 130),
        9 + random() * 13,
        3 + random() * 6,
        random(),
        0,
        Math.PI * 2,
      );
      fg.fill();
    }
    fg.strokeStyle = '#d8b65f66';
    fg.lineWidth = 1;
    for (let i = 0; i < 45; i++) {
      const x = 17 + random() * 78,
        y = 74 + random() * 36;
      fg.beginPath();
      fg.moveTo(x, y);
      fg.lineTo(x + 3 + random() * 4, y - 2);
      fg.stroke();
    }
    put('livestock-floor', floor, a.x0, a.y0, w, h, 0);
    rail('livestock-back', a.x0, a.x1, a.y0 + 12);
    rail('livestock-front', a.x0, a.x1, a.y1);
    for (const x of [a.x0, a.x1 - 9])
      for (let y = a.y0 + 30; y < a.y1; y += 25) {
        if (x === a.x1 - 9 && y > 350 && y < 432) continue;
        put(`pen-post-${x}-${y}`, asset('fence-post-b'), x, y - 20, 10, 26, y);
      }
    for (const y of [348, 438]) put(`pen-gate-post-${y}`, asset('fence-post-b'), a.x1 - 9, y - 20, 10, 26, y);
    object('animal-shelter', 'shelter', a.x0 + 53, a.y0 + 90, 76);
    const feedHeight = (49 * feedFrames[0].height) / feedFrames[0].width;
    put('feed', feedFrames[0], a.x0 + w * 0.59 - 24.5, a.y0 + 62 - feedHeight, 49, feedHeight, a.y0 + 62);
    feedEntry = surfaces.at(-1)!;
    object('feeding-water', 'water-trough', a.x0 + w * 0.59, a.y0 + 98, 45);
    object('feeding-hay', 'hay', a.x0 + w * 0.79, a.y0 + 99, 24);
    object('feeding-grass-left', 'decor-grass-green', a.x0 + 12, a.y0 + 116, 12);
    object('feeding-grass-right', 'decor-grass-yellow', a.x1 - 10, a.y0 + 140, 11);
    object('shelter-grass', 'decor-grass-green', a.x0 + 17, a.y0 + 94, 12);
    object('water', 'water-trough', a.x1 - 43, a.y1 - 20, 46);
    object('pen-hay', 'hay', a.x1 - 32, a.y0 + 44, 33);

    animalMotion = createFarmAnimalMotion(asset, a, progress, false, motionStart);
    surfaces.push(...animalMotion.surfaces);
    freeMotion = createFarmAnimalMotion(asset, { x0: 345, x1: 1018, y0: 392, y1: 651 }, progress, true, motionStart);
    surfaces.push(...freeMotion.surfaces);
    for (const spot of FARM_EGG_BASKET_SPOTS) {
      if (!progress.poultry.some((animal) => animal.species === spot.species)) continue;
      object(`egg-basket-${spot.species}`, 'egg-basket-empty', spot.x, spot.y, 36);
      eggEntries.push({ species: spot.species, surface: surfaces.at(-1)! });
    }
    if (progress.capacity.livestock < FARM_UNIT_LIMITS.livestock)
      object('livestock-buy', 'buy-sign', a.x1 + 23, 435, 30);
    const pond = features.find((f) => f.id === 'pond')!.area,
      pw = pond.x1 - pond.x0,
      ph = pond.y1 - pond.y0;
    const pool = canvas(pw, ph),
      pg = pool.getContext('2d')!;
    pg.fillStyle = '#a1ad66';
    pg.beginPath();
    pg.roundRect(8, 8, pw - 16, ph - 16, 27);
    pg.fill();
    const water = pg.createLinearGradient(0, 0, pw, ph);
    water.addColorStop(0, '#5bc9c0');
    water.addColorStop(0.38, '#1ba4bd');
    water.addColorStop(1, '#52c3cc');
    pg.fillStyle = water;
    pg.beginPath();
    pg.roundRect(11, 11, pw - 22, ph - 22, 23);
    pg.fill();
    pg.save();
    pg.clip();
    const deep = pg.createRadialGradient(pw * 0.55, ph * 0.5, 12, pw * 0.5, ph * 0.5, ph * 0.56);
    deep.addColorStop(0, '#075b9966');
    deep.addColorStop(0.65, '#197bb332');
    deep.addColorStop(1, '#7edcd800');
    pg.fillStyle = deep;
    pg.fillRect(0, 0, pw, ph);
    pg.restore();
    const rocks = asset('shore-rocks');

    function stone(x: number, y: number, width: number) {
      const height = (width * rocks.height) / rocks.width;
      pg.save();
      pg.translate(x, y);
      pg.rotate((random() - 0.5) * 0.32);
      pg.scale(random() > 0.5 ? -1 : 1, 1);
      pg.drawImage(rocks, -width / 2, -height / 2, width, height);
      pg.restore();
    }

    for (let x = 23; x < pw - 20; x += 31) {
      stone(x + (random() - 0.5) * 8, 13 + (random() - 0.5) * 5, 29 + random() * 12);
      stone(x + (random() - 0.5) * 8, ph - 13 + (random() - 0.5) * 5, 29 + random() * 12);
    }
    for (let y = 31; y < ph - 22; y += 25) {
      stone(13 + (random() - 0.5) * 5, y + (random() - 0.5) * 8, 24 + random() * 11);
      stone(pw - 13 + (random() - 0.5) * 5, y + (random() - 0.5) * 8, 24 + random() * 11);
    }
    put('pond-water', pool, pond.x0, pond.y0, pw, ph, 0);
    pondMotion = createFarmPondMotion(asset, pond, levels.pond, progress, motionStart);
    surfaces.push(...pondMotion.surfaces);
    for (let i = 0; i < Math.floor(ph / 95); i++) {
      object(
        `pond-reed-left-${i}`,
        i % 2 ? 'cattails' : 'decor-grass-green',
        pond.x0 + 10,
        pond.y0 + 43 + i * 95 + (i % 3) * 9,
        i % 2 ? 21 : 15,
      );
      object(
        `pond-reed-right-${i}`,
        i % 2 ? 'decor-grass-tall' : 'cattails',
        pond.x1 - 9,
        pond.y0 + 68 + i * 95 - (i % 3) * 7,
        i % 2 ? 16 : 21,
      );
    }
    if (progress.capacity.pond < FARM_UNIT_LIMITS.pond) object('pond-buy', 'buy-sign', pond.x0 + 21, pond.y1 - 15, 34);
    for (const [i, [x, y]] of [
      [a.x0, a.y0 + 20],
      [a.x1, a.y1],
      [pond.x0, pond.y0 + 25],
      [pond.x1, pond.y1],
      [575, 680],
      [704, 680],
    ].entries())
      lamp(`lamp-${i}`, x, y);
    for (let i = 0; i < 8; i++) {
      object(`left-edge-flowers-${i}`, 'flower-border', 45 + i * 39, 665, 40);
    }
    for (const [i, [x, y, width]] of [
      [599, 358, 15],
      [996, 352, 19],
      [365, 640, 17],
      [531, 651, 12],
      [599, 650, 13],
      [765, 641, 18],
      [833, 647, 16],
      [999, 650, 12],
    ].entries()) {
      object(`lawn-edge-flower-${i}`, i % 2 ? 'decor-flowers-white-low' : 'decor-flowers-mixed-low', x, y, width);
    }
    fieldStart = surfaces.length;
    cropSignature = '';
  }

  // Low grass tufts share the tile footprint and disappear as that exact plot is purchased.
  // Few strokes, no dark outline or mound shadow: they read as part of the lawn.
  const reserveGrass = Array.from({ length: 6 }, (_, variant) => {
    const patch = canvas(40, 40),
      cg = patch.getContext('2d')!,
      rng = seededRandom(811 + variant);
    for (let i = 0; i < 3 + (variant % 3); i++) {
      const x = 7 + Math.floor(rng() * 25),
        y = 8 + Math.floor(rng() * 25);
      cg.strokeStyle = i % 2 ? '#638b3f88' : '#a5bf5d99';
      cg.lineWidth = 1;
      cg.beginPath();
      cg.moveTo(x - 2, y - 2);
      cg.lineTo(x, y);
      cg.lineTo(x + 1, y - 3);
      cg.moveTo(x, y);
      cg.lineTo(x + 3, y - 1);
      cg.stroke();
    }
    return patch;
  });
  const states = createFarmCropFrames(asset);
  // One scale per crop keeps its stages growing continuously; wide late stages still fit the plot.
  const cropScales = new Map<CropId, number>();

  function cropScale(id: CropId) {
    let scale = cropScales.get(id);
    if (scale === undefined) {
      const frames = Array.from({ length: CROP_GROWTH_FRAMES[id].ripe + 1 }, (_, i) => asset(cropAssetName(id, i)));
      scale = Math.min(0.4, 36 / Math.max(...frames.map((f) => f.width)));
      cropScales.set(id, scale);
    }
    return scale;
  }

  const plantFrames = new Map<string, { source: HTMLCanvasElement; rise: number; height: number }>();

  function plantFrame(id: CropId, frame: number) {
    const key = `${id}-${frame}`;
    let plant = plantFrames.get(key);
    if (!plant) {
      plant = createFarmPlantFrame(asset(cropAssetName(id, frame)), cropScale(id), states.watered);
      plantFrames.set(key, plant);
    }
    return plant;
  }

  function plotVisual(plot: FarmProgress['plots'][number], now: number) {
    const stage = cropStage(plot, now),
      id = plot.cropId ?? 'strawberry';
    if (stage === 'ripe') return `${id}-${CROP_GROWTH_FRAMES[id].ripe}`;
    if (stage === 'growing') return `${id}-${cropGrowthFrame(id, (now - plot.wateredAt!) / FARM_CROPS[id].growMs)}`;
    return stage;
  }

  function replaceMotionSurfaces(previous: typeof surfaces, next: typeof surfaces) {
    const removed = new Set(previous);
    for (let i = surfaces.length - 1; i >= 0; i--) {
      if (!removed.has(surfaces[i])) continue;
      surfaces.splice(i, 1);
      if (i < fieldStart) fieldStart--;
    }
    surfaces.splice(fieldStart, 0, ...next);
    fieldStart += next.length;
  }

  function refreshHerds() {
    const features = farmFeaturesFor(levels);
    const a = features.find((f) => f.id === 'livestock')!.area;
    const pond = features.find((f) => f.id === 'pond')!.area;
    const old = [...animalMotion!.surfaces, ...freeMotion!.surfaces, ...pondMotion!.surfaces];
    animalMotion = createFarmAnimalMotion(asset, a, progress, false, motionStart);
    freeMotion = createFarmAnimalMotion(asset, { x0: 345, x1: 1018, y0: 392, y1: 651 }, progress, true, motionStart);
    pondMotion = createFarmPondMotion(asset, pond, levels.pond, progress, motionStart);
    replaceMotionSurfaces(old, [...animalMotion.surfaces, ...freeMotion.surfaces, ...pondMotion.surfaces]);
  }

  function sync(now: number, motionTime = Date.now()) {
    const layout = JSON.stringify([
      levels.livestock,
      levels.pond,
      progress.capacity,
      [...new Set(progress.poultry.map((animal) => animal.species))].sort(),
    ]);
    const herd = farmLayoutSignature(progress);
    if (layout !== layoutSignature) {
      layoutSignature = layout;
      rebuild();
      herdSignature = herd;
    } else if (herd !== herdSignature) {
      refreshHerds();
      herdSignature = herd;
    }
    for (const marker of entranceMarkers) marker.surface.y = marker.y + Math.sin(now / 330 + marker.phase * 0.6) * 1.5;
    if (feedEntry) {
      const amount = Math.ceil(farmFoodPercent(progress, 'livestock', now) / 50);
      feedEntry.source = feedFrames[amount];
      feedEntry.key = `farm-feed-v8-${amount}`;
    }
    for (const basket of farmEggBaskets(progress, now)) {
      const entry = eggEntries.find((e) => e.species === basket.species);
      if (!entry) continue;
      const frame = basket.eggs > 0 ? 'egg-basket' : 'egg-basket-empty';
      entry.surface.source = asset(frame);
      const spot = FARM_EGG_BASKET_SPOTS.find((s) => s.species === basket.species)!;
      entry.surface.height = (entry.surface.width * entry.surface.source.height) / entry.surface.source.width;
      entry.surface.y = spot.y - entry.surface.height;
      entry.surface.key = `farm-${basket.species}-${frame}`;
    }
    pondMotion?.sync(now, motionTime);
    animalMotion?.sync(now, motionTime);
    freeMotion?.sync(now, motionTime);
    const visuals = progress.plots.slice(0, progress.owned).map((p) => plotVisual(p, now)),
      signature = `${progress.owned}:${visuals.join(',')}`;
    if (signature === cropSignature) return;
    cropSignature = signature;
    surfaces.splice(fieldStart);
    FARM_PLOTS.forEach((p, i) => {
      if (i < progress.owned) {
        const visual = visuals[i],
          id = progress.plots[i].cropId ?? 'strawberry';
        if (visual in states) {
          put(
            `plot-catalog-${p.id}-${visual}-${id}`,
            states[visual as keyof typeof states],
            p.area.x0,
            p.area.y0,
            40,
            40,
            0,
          );
          return;
        }
        const plant = plantFrame(id, Number(visual.slice(visual.lastIndexOf('-') + 1)));
        put(`plot-catalog-${p.id}-${visual}`, plant.source, p.area.x0, p.area.y0 - plant.rise, 40, plant.height, 0);
      } else if (i > progress.owned && i % 3 !== 0) {
        put(`reserve-grass-${i}`, reserveGrass[i % reserveGrass.length], p.area.x0, p.area.y0, 40, 40, 0);
      }
    });
    const next = FARM_PLOTS[progress.owned];
    if (next) object('buy-sign', 'buy-sign', next.area.x0 + 20, next.area.y1 + 3, 30);
  }

  sync(Date.now());

  function animalAnchors() {
    return [
      ...(animalMotion?.surfaces.map((s, i) => ({
        animal: progress.animals[i],
        unit: 'livestock' as const,
        x: s.x + 26,
        y: s.y,
      })) ?? []),
      ...(freeMotion?.surfaces.map((s, i) => ({
        animal: progress.poultry[i],
        unit: 'poultry' as const,
        x: s.x + 26,
        y: s.y,
      })) ?? []),
      ...(pondMotion?.fishes.map((s, i) => ({
        animal: progress.fish[i],
        unit: 'pond' as const,
        x: s.x + 17,
        y: s.y,
      })) ?? []),
    ];
  }

  return { surfaces, sync, animalAnchors };
}
