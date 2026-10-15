import type { FastifyPluginAsync } from 'fastify';
import { createInventoryController } from '@/modules/inventory/controller';
import { registerInventoryRoutes } from '@/modules/inventory/routes';
import type { InventoryService } from '@/modules/inventory/service';

export { createInventoryService, type InventoryService } from '@/modules/inventory/service';

export const inventoryModule: FastifyPluginAsync<{ service: InventoryService }> = async (app, { service }) => {
  registerInventoryRoutes(app, createInventoryController(service));
};

export { onCharacterInventory } from '@/modules/inventory/transaction';
