import type { FastifyInstance } from 'fastify';
import type { createAuthController } from '@/modules/auth/controller';

export function registerAuthRoutes(app: FastifyInstance, controller: ReturnType<typeof createAuthController>) {
  app.post('/auth/forgot-password', controller.forgotPassword);
  app.post('/auth/change-password', controller.changePassword);
  app.post('/auth/handoff', controller.handoff);
  app.post('/auth/handoff/accept', controller.acceptHandoff);
  app.post('/auth/guest', controller.createGuest);
  app.post('/auth/register', controller.register);
  app.post('/auth/login', controller.login);
  app.post('/auth/username', controller.updateUsername);
  app.post('/player/name', controller.rename);
  app.post('/auth/character', controller.completeCharacter);
  app.post('/auth/logout', controller.logout);
  app.get('/auth/session', controller.session);
  app.get('/auth/sso', controller.ssoSignIn);
  app.get('/auth/sso/callback', controller.ssoCallback);
  app.get('/auth/google', controller.googleSignIn);
  app.get('/auth/google/callback', controller.googleCallback);
}
