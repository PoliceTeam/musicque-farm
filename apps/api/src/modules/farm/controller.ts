import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { FarmService, MapSnapshotInput } from '@/modules/farm/service';

export function createFarmController(service: FarmService) {
  return {
    getInventory(request: FastifyRequest) {
      return service.getInventory(request.player!, operationTrace(request, 'farm.inventory'));
    },

    getMap(request: FastifyRequest<{ Body: MapSnapshotInput }>) {
      return service.getMap(request.player!, request.body, operationTrace(request, 'farm.snapshot'));
    },
  };
}
