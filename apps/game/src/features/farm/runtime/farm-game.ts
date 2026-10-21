import type { Outfit } from '@chibi-town/character-core/character-types';
import type { FarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { blocksGameInput } from '@chibi-town/ui';
import { currentPerformanceLoad, performanceMark } from '@/application/performance-log';
import {
  FARM_CHARACTER_SCALE,
  FARM_WORLD,
  type FarmSelection,
  type FarmUnitLevels,
  farmFeaturesFor,
  farmObstaclesFor,
} from '@/features/farm/_utils/farm-layout';
import {
  cancelFarmWalk,
  createFarmWalkState,
  moveFarmTo,
  updateFarmWalk,
} from '@/features/farm/_utils/farm-walk-logic';
import { createFarmCursor } from '@/features/farm/rendering/farm-cursor-view';
import { drawFarmProgress } from '@/features/farm/rendering/farm-progress-view';
import { farmStyleScenery } from '@/features/farm/rendering/farm-style-view';
import { tickTown } from '@/game/movement/town-logic';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';
import { TownView } from '@/game/rendering/town-view';
import { TICK_MS } from '@/game/runtime/game-config';

export async function createFarmGame(
  parent: HTMLElement,
  outfit: Outfit,
  onSelect: (x: number, y: number) => FarmSelection | undefined,
  levels: FarmUnitLevels = { livestock: 0, pond: 0 },
  progress: FarmProgress,
  clock: () => number = Date.now,
  progressLabels: {
    enter?: string;
    exit?: string;
    avatarLabel?: (level: number, name: string) => string;
    ready: string;
    paused: string;
    eggLabel?: (species: 'hen' | 'duck', count: number) => string;
  } = {
    ready: '✓',
    paused: 'Ⅱ',
  },
  identity?: { name: string; level: number },
) {
  const perfRun = currentPerformanceLoad();
  const [providers, style] = await Promise.all([
    createPreviewProviders('phaser'),
    farmStyleScenery(progress, levels, { enter: progressLabels.enter ?? '', exit: progressLabels.exit ?? '' }),
  ]);
  const farm = createFarmWalkState(outfit, levels, identity);
  const state = farm.town;
  const player = state.player;
  let selection: FarmSelection | undefined;
  const cursor = createFarmCursor();
  farm.obstacles = farmObstaclesFor(farmFeaturesFor(levels));
  const scenery = style.surfaces;
  const view = new TownView(
    state,
    scenery,
    FARM_CHARACTER_SCALE,
    (renderer) => {
      cursor(renderer, selection?.area);
      drawFarmProgress(renderer, progress, style.animalAnchors(), clock(), progressLabels);
    },
    progressLabels.avatarLabel,
  );
  let running = true;
  const renderer = providers.create('phaser', {
    parent,
    width: FARM_WORLD.width,
    height: FARM_WORLD.height,
    zoom: 1,
    renderScale: 2,
    fillParent: true,
    camera: {
      worldWidth: FARM_WORLD.width,
      worldHeight: FARM_WORLD.height,
      zoom: 1,

      target: () => [player.x, player.y],
    },
    backgroundColor: '#7bb457',
    fixedStep: {
      interval: TICK_MS,

      onTick() {
        if (running) tickTown(state);
      },
    },
    input: {
      onPointerDown(x, y) {
        if (!running || blocksGameInput()) return;
        selection = onSelect(x, y);
        moveFarmTo(farm, selection?.stand ?? [x, y]);
      },
    },

    onReady(renderer) {
      parent.dataset.renderer = renderer.kind;
    },

    onFrame(renderer, now, delta, input) {
      if (!running) return;
      const beforeX = player.x,
        beforeY = player.y;
      if (!blocksGameInput())
        updateFarmWalk(farm, Math.min(0.05, Math.max(0, delta / 1000)), input?.direction ?? [0, 0]);
      if (beforeX !== player.x || beforeY !== player.y) performanceMark('movement-observed', perfRun);
      style.sync(clock());
      view.draw(renderer, now);
    },
  });

  const handleCancel = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      cancelFarmWalk(farm);
      selection = undefined;
    }
  };

  window.addEventListener('keydown', handleCancel);
  return {
    moveTo(point: [number, number]) {
      moveFarmTo(farm, point);
    },

    refresh() {
      farm.obstacles = farmObstaclesFor(farmFeaturesFor(levels));
      style.sync(clock());
    },

    isAt(point: [number, number]) {
      return Math.hypot(player.x - point[0], player.y - point[1]) <= 4;
    },

    clearSelection() {
      selection = undefined;
    },

    destroy() {
      running = false;
      window.removeEventListener('keydown', handleCancel);
      renderer.destroy();
    },
  };
}
