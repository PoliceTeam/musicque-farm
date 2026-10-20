import { seededRandom } from '@chibi-town/character-core/random';
import { ENTRANCE_LAWNS, ENTRANCE_SIZE } from '@/features/farm-entrance/_utils/entrance-layout';

function canvas(width: number, height: number) {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  return source;
}

/** Reflect the texture in both axes so a repeated ground tile has no hard seams. */
function groundTile(source: HTMLCanvasElement, size: number) {
  const tile = canvas(size * 2, size * 2);
  const g = tile.getContext('2d')!;
  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      g.save();
      g.translate(x ? size * 2 : 0, y ? size * 2 : 0);
      g.scale(x ? -1 : 1, y ? -1 : 1);
      g.drawImage(source, 0, 0, size, size);
      g.restore();
    }
  }
  return tile;
}

/** A daylit, layered landscape; the supplied layout image is never loaded as a background. */
export function createEntranceTerrain(asset: (name: string) => HTMLCanvasElement) {
  const ground = canvas(ENTRANCE_SIZE.width, ENTRANCE_SIZE.height);
  const g = ground.getContext('2d')!;
  const random = seededRandom(318);
  const sky = g.createLinearGradient(0, 0, 0, 390);
  sky.addColorStop(0, '#35aafa');
  sky.addColorStop(1, '#91dbed');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1280, 720);

  // Fade the sky strip into open blue above it, preserving the original cloud proportions.
  const clouds = canvas(1280, 282);
  const cg = clouds.getContext('2d')!;
  cg.drawImage(asset('farmstead-sky'), 0, 0, 1280, 282);
  cg.globalCompositeOperation = 'destination-in';
  const fade = cg.createLinearGradient(0, 0, 0, 282);
  fade.addColorStop(0, '#ffffff00');
  fade.addColorStop(0.28, '#ffffff');
  fade.addColorStop(1, '#ffffff');
  cg.fillStyle = fade;
  cg.fillRect(0, 0, 1280, 282);
  g.drawImage(clouds, 0, 70);
  g.drawImage(asset('farmstead-mountains'), 0, 293, 1280, 106);
  g.drawImage(asset('farmstead-woodland'), -12, 318, 1304, 112);

  g.fillStyle = '#dcb270';
  g.fillRect(0, 398, 1280, 322);
  g.save();
  g.globalAlpha = 0.75;
  g.fillStyle = g.createPattern(groundTile(asset('country-dirt'), 320), 'repeat')!;
  g.fillRect(0, 398, 1280, 322);
  g.restore();

  const grass = g.createPattern(groundTile(asset('meadow-grass'), 220), 'repeat')!;
  for (const [x, y, width, height] of ENTRANCE_LAWNS) {
    const edge = new Path2D();
    edge.moveTo(x, y);
    edge.lineTo(x + width, y);
    // Rounded corners and irregular verges soften the junctions with the road.
    const corner = 18;
    for (let dy = 0; dy <= height - corner; dy += 4) edge.lineTo(x + width + Math.sin(dy / 17) * 3, y + dy);
    edge.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
    for (let dx = width - corner; dx >= corner; dx -= 4) edge.lineTo(x + dx, y + height + Math.sin(dx / 23) * 3);
    edge.quadraticCurveTo(x, y + height, x, y + height - corner);
    for (let dy = height - corner; dy >= 0; dy -= 4) edge.lineTo(x + Math.sin(dy / 21) * 3, y + dy);
    edge.closePath();
    g.fillStyle = '#9bbb45';
    g.fill(edge);
    g.save();
    g.clip(edge);
    g.globalAlpha = 0.64;
    g.fillStyle = grass;
    g.fillRect(x - 5, y - 5, width + 10, height + 10);
    g.restore();
    // A broad translucent verge blends soil and lawn without a hard outline.
    g.strokeStyle = '#829c3b24';
    g.lineWidth = 9;
    g.stroke(edge);
    g.strokeStyle = '#b2c25d55';
    g.lineWidth = 3;
    g.stroke(edge);

    const fringe = asset('farmstead-grass-tuft');
    const flower = asset('farmstead-flower-bush');

    const plant = (px: number, py: number, index: number) => {
      const width = 19 + random() * 13;
      const height = (width * fringe.height) / fringe.width;
      g.drawImage(fringe, px - width / 2, py - height + 4, width, height);
      if (index % 9 === 4) {
        const size = 12 + random() * 5;
        g.drawImage(flower, px - size / 2 + 5, py - size + 3, size, (size * flower.height) / flower.width);
      }
    };

    // Small overlapping clumps use the supplied artwork, at varied spacing and scale.
    let index = 0;
    for (let dx = corner; dx < width - corner; dx += 14 + random() * 9) {
      const py = y + height + Math.sin(dx / 23) * 3;
      plant(x + dx, py, index++);
    }
    for (let dy = 66; dy < height - corner; dy += 8 + random() * 4) {
      plant(x + Math.sin(dy / 21) * 3, y + dy, index++);
      plant(x + width + Math.sin(dy / 17) * 3, y + dy + 2, index++);
    }
    // Follow the lower corner arcs instead of exposing a square end behind the fringe.
    for (const angle of [0.3, 0.8, 1.3]) {
      plant(x + corner - Math.cos(angle) * corner, y + height - corner + Math.sin(angle) * corner, index++);
      plant(x + width - corner + Math.cos(angle) * corner, y + height - corner + Math.sin(angle) * corner, index++);
    }
    if (y > 600) {
      for (let dx = 0; dx < width; dx += 16 + random() * 10) plant(x + dx, y + 4, index++);
    }
  }
  // A continuous distant meadow sits behind the fence; paths begin below the horizon.
  const horizon = g.createLinearGradient(0, 366, 0, 420);
  horizon.addColorStop(0, '#99bf5700');
  horizon.addColorStop(0.6, '#99bf57');
  horizon.addColorStop(1, '#a8c25700');
  g.fillStyle = horizon;
  g.fillRect(0, 366, 1280, 54);
  // Reuse the entertainment street asphalt and curb at the square's lower edge.
  g.fillStyle = '#393b3c';
  g.fillRect(0, 658, ENTRANCE_SIZE.width, 62);
  for (let x = 0; x < ENTRANCE_SIZE.width; x += 120) {
    g.drawImage(asset('road'), x, 658, 120, 110);
    g.drawImage(asset('curb'), x, 647, 120, 26);
  }
  g.fillStyle = '#e6e5dc';
  for (const x of [140, 550, 960]) g.fillRect(x, 695, 170, 11);
  return ground;
}
