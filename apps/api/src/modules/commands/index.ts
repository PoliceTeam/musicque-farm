import type { FastifyPluginAsync } from 'fastify';
import { createCommandController } from '@/modules/commands/controller';
import { registerCommandRoutes } from '@/modules/commands/routes';
import type { FarmService } from '@/modules/farm';
import type { InventoryService } from '@/modules/inventory';

export const commandsModule: FastifyPluginAsync<{ farm: FarmService; inventory: InventoryService }> = async (
  app,
  services,
) => {
  registerCommandRoutes(app, createCommandController(services));
};
