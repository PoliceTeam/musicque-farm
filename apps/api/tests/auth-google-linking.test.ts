import { afterAll, beforeAll, expect, it } from 'vitest';
import { signInWithProvider } from '@/modules/auth/service';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('replaces unverified password access and revokes all sessions when Google claims the email', async () => {
  const old = await t.register('claimed');
  const linked = await signInWithProvider(
    t.db,
    {
      provider: 'google',
      subject: 'verified-owner',
      email: 'claimed@example.test',
      emailVerified: true,
      name: 'Owner',
    },
    undefined,
    t.clock(),
  );
  expect(linked.id).toBe(old.player.id);
  const login = await t.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'claimed@example.test', password: 'correct horse' },
  });
  expect(login.statusCode).toBe(401);
  const session = await t.app.inject({ url: '/api/auth/session', headers: { cookie: old.cookie } });
  expect(session.json().player).toBeNull();
});
