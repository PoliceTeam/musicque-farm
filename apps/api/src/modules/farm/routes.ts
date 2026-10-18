import type { StealFarmCrop } from '@chibi-town/contracts/farm-social';
import type { FastifyInstance } from 'fastify';
import type { createFarmController } from '@/modules/farm/controller';
import type { MapSnapshotInput } from '@/modules/farm/service';

export function registerFarmRoutes(app: FastifyInstance, controller: ReturnType<typeof createFarmController>) {
  app.get('/farms/thefts', controller.getFarmTheftHistory);
  app.get<{ Params: { ownerId: string } }>('/farms/:ownerId', controller.getFarmVisit);
  app.post<{ Body: StealFarmCrop }>('/farms/steal', controller.stealFarmCrop);
  app.get('/inventory', controller.getInventory);
  app.post<{ Body: MapSnapshotInput }>('/maps/snapshot', controller.getMap);
}
