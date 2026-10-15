import type { FastifyPluginAsync } from 'fastify';
import { createFarmController } from '@/modules/farm/controller';
import { registerFarmRoutes } from '@/modules/farm/routes';
import type { FarmService } from '@/modules/farm/service';

export { createFarmService, type FarmService } from '@/modules/farm/service';

export const farmModule: FastifyPluginAsync<{ service: FarmService }> = async (app, { service }) => {
  registerFarmRoutes(app, createFarmController(service));
};
