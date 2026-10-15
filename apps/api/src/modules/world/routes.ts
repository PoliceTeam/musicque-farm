import type { MapChannelInput } from '@chibi-town/contracts';
import type { FastifyInstance } from 'fastify';
import type { createWorldController } from '@/modules/world/controller';

export function registerWorldRoutes(app: FastifyInstance, controller: ReturnType<typeof createWorldController>) {
  app.get('/world', controller.getWorld);
  app.post<{ Body: MapChannelInput }>('/maps/channels', controller.getChannels);
  app.post<{ Body: MapChannelInput & { channelId: number } }>('/maps/channels/join', controller.joinChannel);
}
