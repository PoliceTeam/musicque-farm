import type { CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { InventoryService } from '@/modules/inventory/service';

export function createInventoryController(service: InventoryService) {
  return {
    getInventory(request: FastifyRequest<{ Body: CharacterInventoryQuery }>) {
      return service.getInventory(request.player!, request.body, operationTrace(request, 'inventory.read'));
    },
  };
}
