import type { CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { LuckyDrawCommand } from '@chibi-town/contracts/lucky-draw';
import type { FastifyInstance } from 'fastify';
import type { createInventoryController } from '@/modules/inventory/controller';

export function registerInventoryRoutes(
  app: FastifyInstance,
  controller: ReturnType<typeof createInventoryController>,
) {
  app.get('/lucky-draw', controller.getLuckyDraw);
  app.post<{ Body: LuckyDrawCommand }>('/lucky-draw', controller.executeLuckyDraw);
  app.post<{ Body: CharacterInventoryQuery }>('/character-inventory', controller.getInventory);
}
