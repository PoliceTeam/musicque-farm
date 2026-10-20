import type { MapLayer } from '@chibi-town/game-content';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { drawNpcLabel } from '@/game/rendering/avatar-label';
import { npcPlacement } from '@/game/rendering/npc-placement';

/** Shared raster NPC component: consistent scale, original art and inline red service star. */
export function createServiceNpcView(layer: MapLayer, source: HTMLCanvasElement, name: () => string) {
  const position = npcPlacement(source, layer.x + layer.width / 2, layer.y + layer.height);
  return {
    paint(view: CharacterRenderer) {
      view.surface(`service-npc:${layer.id}`, source, position.x, position.y, position.width, position.height);
    },

    paintLabel(view: CharacterRenderer) {
      if (layer.npcNameplate) drawNpcLabel(view, name(), layer.x + layer.width / 2, position.headTop);
    },
  };
}
