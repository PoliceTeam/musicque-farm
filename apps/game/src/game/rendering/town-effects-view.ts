import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { type HatLight, STYLES } from '@/features/character/_utils/effect-logic';
import type { EffectSource } from '@/game/movement/town-logic';

export function colorNumber(color: string) {
  return Number.parseInt(color.slice(1), 16);
}

export function paintEmitter(
  renderer: CharacterRenderer,
  key: string,
  source: EffectSource,
  x: number,
  y: number,
  moving: boolean,
  scale = 1,
) {
  const style = STYLES[source.kind];
  renderer.particles(key, {
    x,
    y,
    moving,
    areas: (Array.isArray(source.area) ? source.area : [source.area]).map((area) => ({
      x0: area.x0 * scale,
      x1: area.x1 * scale,
      y0: area.y0 * scale,
      y1: area.y1 * scale,
    })),
    style: {
      ...style,
      vx: style.vx * scale,
      vy: style.vy * scale,
      sway: style.sway * scale,
      gravity: style.gravity * scale,
      size: [style.size[0] * scale, style.size[1] * scale],
    },
  });
}

export function paintHatLights(renderer: CharacterRenderer, lights: HatLight[], x: number, y: number, scale = 1) {
  for (const light of lights)
    renderer.rectangle(x + light.x * scale, y + light.y * scale, scale, scale, colorNumber(light.color));
}
