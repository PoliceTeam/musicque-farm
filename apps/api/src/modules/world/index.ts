import type { FastifyPluginAsync } from 'fastify';
import { createWorldController } from '@/modules/world/controller';
import { registerWorldRoutes } from '@/modules/world/routes';
import type { WorldService } from '@/modules/world/service';

export { createWorldService, type WorldService } from '@/modules/world/service';

export const worldModule: FastifyPluginAsync<{ service: WorldService }> = async (app, { service }) => {
  registerWorldRoutes(app, createWorldController(service));
};

export { type ChannelPresence, createChannelPresence } from '@/modules/world/channel-presence';
export { createJewelerAccess } from '@/modules/world/jeweler-access';
export { createMapRooms, MAP_LEASE_MS } from '@/modules/world/map-rooms';
export { registerPublicChat } from '@/modules/world/public-chat';
export { registerWorldRealtime } from '@/modules/world/realtime';
