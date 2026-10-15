import type { FastifyPluginAsync } from 'fastify';
import { createAuthController } from '@/modules/auth/controller';
import { registerAuthRoutes } from '@/modules/auth/routes';

export { createSessionHook } from '@/modules/auth/session-hook';

export const authModule: FastifyPluginAsync<Parameters<typeof createAuthController>[0]> = async (app, deps) => {
  registerAuthRoutes(app, createAuthController(deps));
};
