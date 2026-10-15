import type { CharacterInventoryQuery } from '@chibi-town/contracts/character-inventory';
import type { FastifyInstance } from 'fastify';
import type { createInventoryController } from '@/modules/inventory/controller';

export function registerInventoryRoutes(
  app: FastifyInstance,
  controller: ReturnType<typeof createInventoryController>,
) {
  app.post<{ Body: CharacterInventoryQuery }>('/character-inventory', controller.getInventory);
}
