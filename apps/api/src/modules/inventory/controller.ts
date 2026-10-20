import type { CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { JewelerCommand } from '@chibi-town/contracts/jeweler';
import type { LuckyDrawCommand } from '@chibi-town/contracts/lucky-draw';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { InventoryService } from '@/modules/inventory/service';

export function createInventoryController(service: InventoryService) {
  return {
    getJeweler(request: FastifyRequest) {
      return service.getJeweler(request.player!, operationTrace(request, 'jeweler.read'));
    },

    executeJeweler(request: FastifyRequest<{ Body: JewelerCommand }>) {
      return service.executeJeweler(request.player!, request.body, operationTrace(request, 'jeweler.execute'));
    },

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
