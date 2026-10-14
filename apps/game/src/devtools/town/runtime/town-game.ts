import type { Outfit } from '@chibi-town/character-core/character-types';
import { blocksGameInput } from '@chibi-town/ui';
import { createTownState, moveTownTo, setTownOutfit, tickTown, updateTown } from '@/devtools/town/_utils/town-logic';
import { SCREEN, TOWN_ZOOM, WORLD } from '@/devtools/town/_utils/town-map';
import { TownView } from '@/devtools/town/rendering/town-view';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';
import { TICK_MS } from '@/game/runtime/game-config';

/** Composition root; simulation state is separate from this runtime's lifecycle. */
export async function createTownGame(parent: HTMLElement, outfit: Outfit) {
  const providers = await createPreviewProviders('phaser');
  const state = createTownState(outfit);
  const view = new TownView(state);
  let running = false;
  const renderer = providers.create('phaser', {
    parent,
    width: SCREEN.width,
    height: SCREEN.height,
    zoom: SCREEN.scale,
    renderScale: SCREEN.scale,
    fillParent: true,
    camera: {
      worldWidth: WORLD.width,
      worldHeight: WORLD.height,
      zoom: TOWN_ZOOM,

      target: () => [state.player.x, state.player.y],
    },
    fixedStep: {
      interval: TICK_MS,

      onTick() {
        if (running) tickTown(state);
      },
    },
    input: {
      onPointerDown(x, y) {
        if (running && !blocksGameInput()) moveTownTo(state, x, y);
      },
    },
    backgroundColor: '#75af51',

    onReady: (renderer) => {
      parent.dataset.renderer = renderer.kind;
    },

    onFrame(renderer, now, delta, input) {
      if (!running || blocksGameInput()) return;
      const elapsed = Math.max(0, Math.min(delta, 50));
      updateTown(state, elapsed / 1000, input?.direction ?? [0, 0]);
      view.draw(renderer, now);
    },
  });
  renderer.setActive(false);
  return {
    pieces: view.pieces,
    player: state.player,

    setOutfit(next: Outfit) {
      setTownOutfit(state, next);
    },

    start() {
      running = true;
      renderer.setActive(true);
      return () => {
        running = false;
        renderer.setActive(false);
      };
    },

    destroy() {
      running = false;
      renderer.destroy();
    },
  };
}
