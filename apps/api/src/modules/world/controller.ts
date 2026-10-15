import type { MapChannelInput } from '@chibi-town/contracts';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { WorldService } from '@/modules/world/service';

export function createWorldController(service: WorldService) {
  return {
    getWorld(request: FastifyRequest) {
      return service.getWorld(request.player!, operationTrace(request, 'world.read'));
    },

    getChannels(request: FastifyRequest<{ Body: MapChannelInput }>) {
      return service.getChannels(request.player!, request.body, operationTrace(request, 'world.channels'));
    },

    joinChannel(request: FastifyRequest<{ Body: MapChannelInput & { channelId: number } }>) {
      return service.joinChannel(request.player!, request.body, operationTrace(request, 'world.join'));
    },
  };
}
