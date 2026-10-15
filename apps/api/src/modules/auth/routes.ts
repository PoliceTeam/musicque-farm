import type { FastifyInstance } from 'fastify';
import type { createAuthController } from '@/modules/auth/controller';

export function registerAuthRoutes(app: FastifyInstance, controller: ReturnType<typeof createAuthController>) {
  app.post('/auth/guest', controller.createGuest);
  app.post('/auth/register', controller.register);
  app.post('/auth/login', controller.login);
  app.post('/auth/username', controller.updateUsername);
  app.post('/player/name', controller.rename);
  app.post('/auth/character', controller.completeCharacter);
  app.post('/auth/logout', controller.logout);
  app.get('/auth/session', controller.session);
  app.get('/auth/google', controller.googleSignIn);
  app.get('/auth/google/callback', controller.googleCallback);
}
