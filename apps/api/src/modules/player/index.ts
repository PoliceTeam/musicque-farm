import type { FastifyPluginAsync } from 'fastify';
import { registerPlayerRoutes } from '@/modules/player/routes';
import type { PlayerService } from '@/modules/player/service';

export {
  type PlayerTransaction,
  type TransactionTrace,
  withPlayerDocument,
  withPlayerTransaction,
} from '@/modules/player/repository';
export { createPlayerService, type PlayerService } from '@/modules/player/service';

export const playerModule: FastifyPluginAsync<{ service: PlayerService }> = async (app, { service }) => {
  registerPlayerRoutes(app, service);
};
