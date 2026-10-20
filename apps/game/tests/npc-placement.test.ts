import { NPC_DISPLAY_HEIGHT } from '@chibi-town/game-content/service-npc';
import { expect, it, vi } from 'vitest';
import { npcPlacement } from '@/game/rendering/npc-placement';

it('keeps farm and shop NPCs the same visible height without stretching source artwork', () => {
  for (const [width, height, top, bottom] of [
    [100, 130, 13, 126],
    [180, 240, 8, 225],
    [160, 200, 24, 188],
  ]) {
    const data = new Uint8ClampedArray(width * height * 4);
    data[(top * width + 10) * 4 + 3] = 255;
    data[((bottom - 1) * width + width - 11) * 4 + 3] = 255;
    const read = vi.fn(() => ({ data }));
    const source = {
      width,
      height,

      getContext: () => ({ getImageData: read }),
    } as unknown as HTMLCanvasElement;
    const placement = npcPlacement(source, 400, 560);
    expect(placement.headTop).toBe(560 - NPC_DISPLAY_HEIGHT);
    expect(placement.height / height).toBeCloseTo(placement.width / width);
    expect(((bottom - top) * placement.height) / height).toBeCloseTo(NPC_DISPLAY_HEIGHT);
    expect(placement.y + (bottom * placement.height) / height).toBeCloseTo(560);
    npcPlacement(source, 450, 580);
    expect(read).toHaveBeenCalledOnce();
  }
});
