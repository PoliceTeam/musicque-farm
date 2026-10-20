import { NPC_DISPLAY_HEIGHT } from '@chibi-town/game-content/service-npc';

const bounds = new WeakMap<HTMLCanvasElement, { left: number; top: number; right: number; bottom: number }>();

/** All raster NPCs use the same visible height, preserving aspect ratio and transparent margins. */
export function npcPlacement(source: HTMLCanvasElement, centerX: number, feetY: number) {
  let box = bounds.get(source);
  if (!box) {
    let left = source.width,
      top = source.height,
      right = 0,
      bottom = 0;
    const pixels = source.getContext('2d')?.getImageData(0, 0, source.width, source.height).data;
    if (pixels)
      for (let y = 0; y < source.height; y++)
        for (let x = 0; x < source.width; x++)
          if (pixels[(y * source.width + x) * 4 + 3] >= 128) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + 1);
            bottom = Math.max(bottom, y + 1);
          }
    box =
      right > left && bottom > top
        ? { left, top, right, bottom }
        : { left: 0, top: 0, right: source.width, bottom: source.height };
    bounds.set(source, box);
  }
  const scale = NPC_DISPLAY_HEIGHT / (box.bottom - box.top);
  return {
    x: centerX - ((box.left + box.right) / 2) * scale,
    y: feetY - box.bottom * scale,
    width: source.width * scale,
    height: source.height * scale,
    headTop: feetY - NPC_DISPLAY_HEIGHT,
  };
}
