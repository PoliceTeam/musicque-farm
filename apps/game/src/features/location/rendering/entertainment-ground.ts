import { seededRandom } from '@chibi-town/character-core/random';
import { entertainmentUrls, sceneryUrls } from '@/assets/generated-assets';

/** Bake staggered cobbles using texture from the supplied stone interiors, avoiding repeated atlas borders. */
export async function createEntertainmentGround(width: number, height: number) {
  const images = await Promise.all(
    ['paving-a', 'paving-b', 'paving-c'].map(async (key) => {
      const image = new Image();
      image.src = sceneryUrls[`scenery:${key}`];
      await image.decode();
      return image;
    }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(907);
  ctx.fillStyle = '#b8b5ac';
  ctx.fillRect(0, 0, width, height);
  for (let row = -1; row * 27 < height; row++) {
    for (let column = -1; column * 58 < width; column++) {
      const x = column * 58 + (row % 2 ? 29 : 0);
      const y = row * 27;
      const bevel = 3 + random() * 5;
      const points = [
        [x + bevel, y + 1],
        [x + 50, y + 1 + random() * 2],
        [x + 56 + random(), y + 5 + random() * 3],
        [x + 57, y + 20],
        [x + 47 + random() * 6, y + 25 + random()],
        [x + 3 + random() * 6, y + 25 + random()],
        [x + 1 + random() * 2, y + 17 + random() * 5],
        [x + 1, y + 7],
      ];
      ctx.save();
      ctx.beginPath();
      points.forEach(([px, py], index) => {
        if (index) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
      const shade = Math.round(177 + random() * 16);
      ctx.fillStyle = `rgb(${shade + 6},${shade + 5},${shade})`;
      ctx.fill();
      ctx.clip();
      ctx.globalAlpha = 0.3;
      const image = images[Math.floor(random() * images.length)];
      // Sample a stone interior rather than the borders of an entire atlas tile.
      ctx.drawImage(image, 8, 8, 20, 12, x, y, 58, 27);
      ctx.fillStyle = `rgba(255,255,245,${random() * 0.12})`;
      ctx.fillRect(x, y, 58, 27);
      ctx.restore();
      ctx.strokeStyle = '#9e9d95';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  return canvas;
}

/** Extend the post shaft while preserving the source meter's native proportions. */
export function createEntertainmentPole(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 43;
  canvas.height = 440;
  const ctx = canvas.getContext('2d')!;
  const metal = ctx.createLinearGradient(10, 0, 33, 0);
  metal.addColorStop(0, '#777d7e');
  metal.addColorStop(0.35, '#e5e7df');
  metal.addColorStop(0.7, '#c4c8c1');
  metal.addColorStop(1, '#6d7270');
  ctx.fillStyle = metal;
  ctx.fillRect(13, 0, 19, 440);
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 152, 43, 128);
  ctx.drawImage(source, 0, 0, source.width, 10, 0, 0, 43, 12);
  ctx.strokeStyle = '#3b4140';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(22, 72, 11, 15, 0, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
}

/** Separate continuous sky color from the transparent skyline and moving clouds. */
export function createEntertainmentSky(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#20aff4');
  gradient.addColorStop(0.65, '#63cdf8');
  gradient.addColorStop(1, '#b5e7f6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/** The blank plate displays the SDK's selected channel without changing the original rim or post. */
export function createEntertainmentSign(source: HTMLCanvasElement, channelId: number | undefined, label: string) {
  const canvas = document.createElement('canvas');
  // Bake text at 3x resolution so accents remain clear at the normal map scale.
  canvas.width = source.width * 3;
  canvas.height = source.height * 3;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(3, 3);
  ctx.drawImage(source, 0, 0);
  ctx.font = '900 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#242a2c';
  ctx.fillText(label, 29, 22, 36);
  ctx.font = '900 26px Arial, sans-serif';
  ctx.fillText(channelId === undefined ? '…' : String(channelId), 29, 42, 36);
  return canvas;
}

/** Keep the supplied complete disc; numbers are baked once and rotate with it. */
export function createEntertainmentWheel(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  ctx.font = '900 16px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff5c7';
  ['20', '1', '0', '10', '1', '1'].forEach((label, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    ctx.fillText(label, canvas.width / 2 + Math.cos(angle) * 39, canvas.height / 2 + Math.sin(angle) * 39);
  });
  return canvas;
}

/** Shared soft ground contact; rasterized once and reused at each object's feet. */
export function createEntertainmentShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(1, 0.25);
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(54,51,38,0.2)');
  gradient.addColorStop(0.6, 'rgba(54,51,38,0.11)');
  gradient.addColorStop(1, 'rgba(54,51,38,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

/** Rebuild the continuous span with the original cable material and clamp artwork. */
export async function createEntertainmentWires(width: number) {
  const [profile, clamp] = await Promise.all(
    ['cable-profile', 'cable-clamp'].map(async (key) => {
      const image = new Image();
      image.src = entertainmentUrls[`entertainment:${key}`];
      await image.decode();
      return image;
    }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;

  const cableY = (x: number) => {
    if (x <= 315) {
      const t = x / 315;
      return 28 - 10 * t + 24 * t * (1 - t);
    }
    if (x <= 1215) {
      const t = (x - 315) / 900;
      return 18 + 128 * t * (1 - t);
    }
    const t = (x - 1215) / (width - 1215);
    return 18 + 20 * t + 32 * t * (1 - t);
  };

  for (const offset of [0, 14]) {
    // Sample one clean original cable cross-section, retaining its edge and highlight.
    for (let x = 0; x < width; x++) ctx.drawImage(profile, 1, 0, 1, profile.height, x, cableY(x) + offset - 4, 1, 9);
    for (const x of [3, 95, 315, 475, 700, 945, 1120, 1215, 1390, 1590]) {
      const y = cableY(x) + offset;
      ctx.drawImage(clamp, x - 8, y - 11, 16, 22);
    }
  }
  return canvas;
}

/** A low planted strip hides the skyline's blue edge beneath the storefront foliage. */
export function createEntertainmentGarden(width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 65;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(512);
  ctx.beginPath();
  ctx.moveTo(0, 18);
  for (let x = 0; x <= width; x += 12) ctx.lineTo(x, 14 + random() * 8);
  for (let x = width; x >= 0; x -= 12) ctx.lineTo(x, 55 + random() * 6);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, 15, 0, 62);
  gradient.addColorStop(0, '#52643e');
  gradient.addColorStop(1, '#486341');
  ctx.fillStyle = gradient;
  ctx.fill();
  for (let i = 0; i < width; i++) {
    const x = random() * width,
      y = 22 + random() * 37;
    ctx.strokeStyle = i % 2 ? '#699149' : '#375d35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 3 - random() * 3);
    ctx.stroke();
  }
  return canvas;
}

/** Assemble the two outer supports onto the same ground line as the three inner feet. */
export function createEntertainmentBillboard(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  for (const [x, width] of [
    [9, 32],
    [326, 33],
  ]) {
    // Keep the original cap and shaft material; move only the lower support pieces.
    ctx.clearRect(x, 116, width, 24);
    ctx.drawImage(source, x, 104, width, 1, x, 116, width, 14);
    ctx.drawImage(source, x, 120, width, 18, x, 130, width, 18);
  }
  return canvas;
}
