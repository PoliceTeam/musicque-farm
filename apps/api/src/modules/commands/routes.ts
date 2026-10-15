import type { Command } from '@chibi-town/contracts';
import type { FastifyInstance } from 'fastify';
import type { createCommandController } from '@/modules/commands/controller';

export function registerCommandRoutes(app: FastifyInstance, controller: ReturnType<typeof createCommandController>) {
  app.post<{ Body: Command }>('/commands', controller.execute);
}
