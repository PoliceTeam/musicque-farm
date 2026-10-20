import type { MapLayer } from '@chibi-town/game-content';

/** Service NPCs take precedence over the storefront behind them, including when their bounds overlap. */
export function serviceNpcAt(layers: readonly MapLayer[], x: number, y: number) {
  return [...layers]
    .reverse()
    .find(
      (layer) =>
        layer.npcNameplate &&
        layer.npc &&
        layer.shop &&
        x >= layer.x &&
        x <= layer.x + layer.width &&
        y >= layer.y &&
        y <= layer.y + layer.height,
    );
}
