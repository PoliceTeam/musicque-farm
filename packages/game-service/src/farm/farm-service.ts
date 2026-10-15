import { ApiSdkError } from '@chibi-town/contracts';
import { resolveMap } from '@chibi-town/game-content';
import { advanceFarmAnimals, createFarmProgress } from '@chibi-town/gameplay';
import { playerInstance as instance, playerSnapshot as snapshot } from '../player/player-state.js';
import type { PlayerDocument } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';

export function createFarmService(options: GameServiceOptions): Pick<GameService, 'getMap' | 'getInventory'> {
  const clock = options.clock;

  function read() {
    return (document: PlayerDocument) => {
      const now = clock();
      if (advanceFarmAnimals(document.farm, now)) document.revision++;
      return snapshot(document, now);
    };
  }

  return {
    getMap(input) {
      if (
        !(
          options.world?.maps.find((map) => map.regionId === input.regionId && map.id === input.mapId) ??
          resolveMap(input.regionId, input.mapId)
        ) ||
        !/^[-a-zA-Z0-9_]{1,80}$/.test(input.instanceId)
      )
        throw new ApiSdkError('MAP_NOT_FOUND');
      return (document) => {
        const id =
          input.mapId === 'farm-home' && input.instanceId === 'home' ? 'home' : `${input.mapId}:${input.instanceId}`;
        if (id !== 'home') {
          document.instances ??= {};
          document.instances[id] ??= createFarmProgress();
        }
        const farm = instance(document, id);
        const now = clock();
        if (advanceFarmAnimals(farm, now)) document.revision++;
        return snapshot(document, now, farm, id);
      };
    },

    getInventory: read,
  };
}
