import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

describe('Fastify module scopes', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  afterEach(async () => t.close());

  it('keeps public auth usable and authenticates every protected module before handling input', async () => {
    t = await createTestApp();
    const session = await t.app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(session.statusCode).toBe(200);
    expect(session.json().player).toBeNull();

    for (const url of ['/api/player', '/api/world', '/api/inventory', '/api/arcade', '/api/arcade/phom']) {
      const response = await t.app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(401);
      expect(response.json()).toEqual({ code: 'UNAUTHENTICATED' });
    }
    for (const url of [
      '/api/maps/snapshot',
      '/api/maps/channels',
      '/api/maps/channels/join',
      '/api/character-inventory',
      '/api/commands',
      '/api/arcade/diamonds/start',
      '/api/arcade/mini/chess/play',
      '/api/arcade/table/configure',
    ]) {
      const response = await t.app.inject({ method: 'POST', url, payload: {} });
      expect(response.statusCode, url).toBe(401);
      expect(response.json()).toEqual({ code: 'UNAUTHENTICATED' });
    }

    const guest = await t.app.inject({ method: 'POST', url: '/api/auth/guest' });
    expect(guest.statusCode).toBe(201);
    const cookie = String(guest.headers['set-cookie']).split(';')[0];
    const player = await t.app.inject({ method: 'GET', url: '/api/player', headers: { cookie } });
    expect(player.statusCode).toBe(200);
    expect(player.json().id).toBe(guest.json().player.id);
    const invalid = await t.app.inject({ method: 'POST', url: '/api/commands', headers: { cookie }, payload: {} });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ code: 'INVALID_COMMAND' });
  });
});
