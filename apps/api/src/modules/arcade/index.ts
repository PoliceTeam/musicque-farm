import type { FastifyPluginAsync } from 'fastify';
import { createArcadeController } from '@/modules/arcade/controller';
import { registerArcadeRoutes } from '@/modules/arcade/routes';
import type { ArcadeService } from '@/modules/arcade/service';

export { type ArcadeService, createArcadeService } from '@/modules/arcade/service';

export const arcadeModule: FastifyPluginAsync<{ service: ArcadeService }> = async (app, { service }) => {
  registerArcadeRoutes(app, createArcadeController(service));
};

export { arcadeChannel } from '@/modules/arcade/arcade-channel';
export { PET_RACE_TOPIC } from '@/modules/arcade/pet-racing';
export { registerArcadeRealtime } from '@/modules/arcade/realtime';
