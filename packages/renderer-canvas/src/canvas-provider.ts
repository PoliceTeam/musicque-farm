import {
  type CharacterRenderer,
  MAP_LABEL_STYLE,
  type RendererProvider,
} from '@chibi-town/render-contracts/renderer-types';
import { spritePixels, spriteTextureKey } from '@chibi-town/render-contracts/sprite-pixels';

/** Canvas adapter consumes the same native pixels and draw operations as Phaser. */
export const createCanvasProvider: RendererProvider = (options) => {
  if (options.input) throw new Error('Canvas preview does not support gameplay input');
  if (options.fixedStep) throw new Error('Canvas preview does not support gameplay ticks');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  options.parent.append(canvas);
  const cache = new Map<string, HTMLCanvasElement>();
  const used = new Set<string>();
  let destroyed = false;
  let active = true;
  let frame = 0;
  let last: number | undefined;
  const renderer: CharacterRenderer = {
    kind: 'canvas',

    beginFrame() {
      if (destroyed) return;
      used.clear();
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    },

    drawPieces(sheetName, sheet, ops, x, y, scale = 1) {
      if (destroyed) return;
      for (const op of ops) {
        const key = spriteTextureKey(sheetName, op);
        used.add(key);
        let texture = cache.get(key);
        if (!texture) {
          const pixels = spritePixels(sheet, op);
          texture = document.createElement('canvas');
          texture.width = pixels.width;
          texture.height = pixels.height;
          texture.getContext('2d')!.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
          cache.set(key, texture);
        }
        context.save();
        context.translate(x + op.x * scale, y + op.y * scale);
        context.scale(scale, scale);
        if (op.flip) {
          context.translate(texture.width, 0);
          context.scale(-1, 1);
        }
        context.drawImage(texture, 0, 0);
        context.restore();
      }
    },

    rectangle(x: number, y: number, width: number, height: number, color: number, alpha = 1) {
      if (destroyed) return;
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.globalAlpha = alpha;
      context.fillRect(x, y, width, height);
      context.globalAlpha = 1;
    },

    surface(_key, source, x, y, width, height, rotation = 0) {
      if (destroyed) return;
      context.save();
      context.imageSmoothingEnabled = options.smoothSurfaces ?? false;
      context.translate(x + width / 2, y + height / 2);
      context.rotate(rotation);
      context.drawImage(source, -width / 2, -height / 2, width, height);
      context.restore();
    },

    label(text, x, y, color, border, fontSize = MAP_LABEL_STYLE.fontSize) {
      if (destroyed) return;
      context.save();
      context.font = `${MAP_LABEL_STYLE.fontStyle} ${fontSize / 2}px ${MAP_LABEL_STYLE.fontFamily}`;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.lineJoin = 'round';
      context.strokeStyle = MAP_LABEL_STYLE.stroke;
      context.lineWidth = MAP_LABEL_STYLE.strokeWidth / 2;
      if (border) {
        context.shadowColor = border;
        context.shadowBlur = 1.5;
      }
      context.strokeText(text, x, y);
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.fillText(text, x, y);
      context.restore();
    },

    particles() {
      throw new Error('Native effects require Phaser');
    },

    aura() {
      throw new Error('Native effects require Phaser');
    },

    marker() {
      throw new Error('Native effects require Phaser');
    },

    endFrame() {
      if (cache.size <= 512) return;
      for (const key of cache.keys()) {
        if (!used.has(key)) cache.delete(key);
        if (cache.size <= 512) break;
      }
    },

    resize(width: number, height: number, zoom: number) {
      if (destroyed) return;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width * zoom}px`;
      canvas.style.height = `${height * zoom}px`;
      context.imageSmoothingEnabled = false;
    },

    setActive(next) {
      active = next;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      cache.clear();
      canvas.remove();
    },
  };
  renderer.resize(options.width, options.height, options.zoom);

  function tick(now: number) {
    if (destroyed) return;
    if (active) options.onFrame(renderer, now, last === undefined ? 0 : now - last);
    last = now;
    if (!destroyed) frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame((now) => {
    if (destroyed) return;
    options.onReady?.(renderer);
    tick(now);
  });
  return renderer;
};
