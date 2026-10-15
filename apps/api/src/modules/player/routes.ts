import type { FastifyInstance } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { PlayerService } from '@/modules/player/service';

/** A single read needs no separate controller. Authentication is inherited from the parent plugin. */
export function registerPlayerRoutes(app: FastifyInstance, service: PlayerService) {
  app.get('/player', (request) => service.getPlayer(request.player!, operationTrace(request, 'player.read')));
}
