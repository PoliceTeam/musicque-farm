import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import { blocksGameInput } from '@chibi-town/ui';
import { currentPerformanceLoad, performanceMark } from '@/application/performance-log';
import {
  ENTRANCE_SIZE,
  ENTRANCE_WALK_BOUNDS,
  type EntranceAction,
  entranceActionAt,
} from '@/features/farm-entrance/_utils/entrance-layout';
import { type EntranceWalk, stepEntranceWalk } from '@/features/farm-entrance/_utils/entrance-walk-logic';
import { createFarmEntranceView, ENTRANCE_ASSETS } from '@/features/farm-entrance/rendering/farm-entrance-view';
import { acquireSceneAssets } from '@/game/rendering/map-assets';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

export async function createFarmEntranceGame(
  parent: HTMLElement,
  outfit: Outfit,
  name: string,
  onAction: (action: EntranceAction) => void,
  labels: { enter: string; exit: string },
  portals?: HTMLElement | null,
) {
  const perfRun = currentPerformanceLoad();
  const [providers, resources] = await Promise.all([
    createPreviewProviders('phaser'),
    acquireSceneAssets(ENTRANCE_ASSETS),
  ]);
  const hero = new AvatarState(toEquip(outfit));
  const state: EntranceWalk = { x: 640, y: 594 };
  const draw = createFarmEntranceView(resources.assets, name, labels);
  let overlayTransform = ';';
  try {
    const renderer = providers.create('phaser', {
      parent,
      ...ENTRANCE_SIZE,
      fillParent: true,
      camera: {
        worldWidth: ENTRANCE_SIZE.width,
        worldHeight: ENTRANCE_SIZE.height,
        zoom: 1,

        target: () => [state.x, state.y],
      },
      renderScale: 2,
      zoom: 1,
      smoothSurfaces: true,
      backgroundColor: '#35aafa',
      input: {
        onPointerDown(x, y) {
          if (blocksGameInput()) return;
          const designY = y;
          const action = entranceActionAt(x, designY);
          if (action) {
            state.target = undefined;
            onAction(action);
          } else {
            const bounds = ENTRANCE_WALK_BOUNDS;
            state.target = [
              Math.max(bounds.left, Math.min(bounds.right, x)),
              Math.max(bounds.top, Math.min(bounds.bottom, designY)),
            ];
          }
        },
      },
      fixedStep: {
        interval: 90,

        onTick: () => hero.step(),
      },

      onFrame(view, now, delta, input) {
        const motion = stepEntranceWalk(
          state,
          input?.direction ?? [0, 0],
          Math.min(delta, 50) / 1000,
          blocksGameInput(),
        );
        if (motion.moving) performanceMark('movement-observed', perfRun);
        if (motion.dx) hero.mirror = motion.dx < 0;
        hero.setAction(motion.moving ? Action.Walk : Action.Stand);
        draw(view, hero, now, state);
        if (portals && view.clientPoint) {
          const origin = view.clientPoint(0, 0);
          const corner = view.clientPoint(ENTRANCE_SIZE.width, 0);
          if (origin && corner) {
            const scale = (corner[0] - origin[0]) / ENTRANCE_SIZE.width;
            const transform = `matrix(${scale},0,0,${scale},${origin[0]},${origin[1]})`;
            if (transform !== overlayTransform) {
              portals.style.transform = transform;
              overlayTransform = transform;
            }
          }
        }
      },
    });

    return () => {
      renderer.destroy();
      resources.release();
    };
  } catch (error) {
    resources.release();
    throw error;
  }
}
