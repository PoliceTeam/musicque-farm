import { type Command, validateCommand } from '@chibi-town/contracts';
import { isInventoryCommand } from '@chibi-town/game-service';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { FarmService } from '@/modules/farm';
import type { InventoryService } from '@/modules/inventory';

/** Compatibility endpoint for the SDK; business work belongs to the owning module service. */
export function createCommandController(services: { farm: FarmService; inventory: InventoryService }) {
  return {
    execute(request: FastifyRequest<{ Body: Command }>) {
      const command = request.body;
      validateCommand(command);
      const trace = operationTrace(request, command.type, command.requestId);
      return isInventoryCommand(command)
        ? services.inventory.execute(request.player!, command, trace)
        : services.farm.execute(request.player!, command, trace);
    },
  };
}
