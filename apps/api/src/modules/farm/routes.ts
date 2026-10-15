import type { FastifyInstance } from 'fastify';
import type { createFarmController } from '@/modules/farm/controller';
import type { MapSnapshotInput } from '@/modules/farm/service';

export function registerFarmRoutes(app: FastifyInstance, controller: ReturnType<typeof createFarmController>) {
  app.get('/inventory', controller.getInventory);
  app.post<{ Body: MapSnapshotInput }>('/maps/snapshot', controller.getMap);
}
