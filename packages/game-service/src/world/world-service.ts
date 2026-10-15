import {
  ApiSdkError,
  type ChannelDirectory,
  type MapChannelInput,
  validateMapChannelInput,
} from '@chibi-town/contracts';
import { MAPS, REGIONS, resolveMap } from '@chibi-town/game-content';
import type { PlayerDocument } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';

export function createWorldService(
  options: GameServiceOptions,
): Pick<GameService, 'getWorld' | 'getMapChannels' | 'joinMapChannel'> {
  function channelMap(input: MapChannelInput) {
    validateMapChannelInput(input);
    const map =
      options.world?.maps.find((entry) => entry.regionId === input.regionId && entry.id === input.mapId) ??
      resolveMap(input.regionId, input.mapId);
    if (!map?.channels) throw new ApiSdkError('MAP_NOT_FOUND');
    return map;
  }

  function population(mapId: string, id: number, capacity: number) {
    const count = options.channelPopulation?.(mapId, id, capacity) ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count > capacity) throw new ApiSdkError('INVALID_CHANNEL');
    return count;
  }

  function directory(document: PlayerDocument, input: MapChannelInput): ChannelDirectory {
    const map = channelMap(input);
    const { count, capacity } = map.channels!;
    const saved = document.channelSelections?.[map.id];
    const currentChannelId = Number.isSafeInteger(saved) && saved! >= 0 && saved! < count ? saved! : 0;
    return {
      ...input,
      source: options.live ? 'live' : 'mock',
      currentChannelId,
      channels: Array.from({ length: count }, (_, id) => ({
        id,
        capacity,
        occupants: Math.min(capacity, population(map.id, id, capacity) + (id === currentChannelId ? 1 : 0)),
      })),
    };
  }

  return {
    getWorld() {
      return () => structuredClone(options.world ?? { regions: REGIONS, maps: MAPS });
    },

    getMapChannels(input) {
      return (document) => directory(document, input);
    },

    joinMapChannel(input) {
      validateMapChannelInput(input, input.channelId);
      if (!Number.isSafeInteger(input.channelId)) throw new ApiSdkError('INVALID_CHANNEL');
      return (document) => {
        const before = directory(document, input);
        const channel = before.channels.find((entry) => entry.id === input.channelId);
        if (!channel) throw new ApiSdkError('INVALID_CHANNEL');
        if (before.currentChannelId !== input.channelId && channel.occupants >= channel.capacity)
          throw new ApiSdkError('CHANNEL_FULL');
        document.channelSelections ??= {};
        document.channelSelections[input.mapId] = input.channelId;
        return directory(document, { regionId: input.regionId, mapId: input.mapId });
      };
    },
  };
}
