import type { StealFarmCrop } from '@chibi-town/contracts/farm-social';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { FarmService, MapSnapshotInput } from '@/modules/farm/service';

export function createFarmController(service: FarmService) {
  return {
    getFarmVisit(request: FastifyRequest<{ Params: { ownerId: string } }>) {
      return service.getFarmVisit(request.player!, request.params.ownerId);
    },

    stealFarmCrop(request: FastifyRequest<{ Body: StealFarmCrop }>) {
      return service.stealFarmCrop(request.player!, request.body);
    },

    getFarmTheftHistory(request: FastifyRequest) {
      return service.getFarmTheftHistory(request.player!, operationTrace(request, 'farm.thefts'));
    },

    getInventory(request: FastifyRequest) {
      return service.getInventory(request.player!, operationTrace(request, 'farm.inventory'));
    },

    getMap(request: FastifyRequest<{ Body: MapSnapshotInput }>) {
      return service.getMap(request.player!, request.body, operationTrace(request, 'farm.snapshot'));
    },
  };
}
