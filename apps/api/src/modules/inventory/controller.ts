import type { CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { LuckyDrawCommand } from '@chibi-town/contracts/lucky-draw';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { InventoryService } from '@/modules/inventory/service';

export function createInventoryController(service: InventoryService) {
  return {
    getLuckyDraw(request: FastifyRequest) {
      return service.getLuckyDraw(request.player!, operationTrace(request, 'lucky-draw.read'));
    },

    executeLuckyDraw(request: FastifyRequest<{ Body: LuckyDrawCommand }>) {
      return service.executeLuckyDraw(request.player!, request.body, operationTrace(request, 'lucky-draw.execute'));
    },

    getInventory(request: FastifyRequest<{ Body: CharacterInventoryQuery }>) {
      return service.getInventory(request.player!, request.body, operationTrace(request, 'inventory.read'));
    },
  };
}
