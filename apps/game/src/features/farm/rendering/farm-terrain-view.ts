import { seededRandom } from '@chibi-town/character-core/random';
import { FARM_WORLD } from '@/features/farm/_utils/farm-layout';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Shared accepted farm soil, grass, texture scale and sky. */
export function createFarmTerrain(
  asset: (name: string) => HTMLCanvasElement,
  beds: readonly (readonly [number, number, number, number])[],
) {
  const ground = canvas(FARM_WORLD.width, FARM_WORLD.height),
    g = ground.getContext('2d')!;
  const random = seededRandom(421);
  const sand = g.createLinearGradient(0, 150, 0, 720);
  sand.addColorStop(0, '#bc995f');
  sand.addColorStop(0.45, '#d5b176');
  sand.addColorStop(1, '#d9b77c');
  g.fillStyle = sand;
  g.fillRect(0, 0, 1280, 720);
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
  return { ground, random };
}
