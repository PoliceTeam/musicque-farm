import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

it('limits concurrent failed logins inside the same lock', async () => {
  await t.register('ratetest');
  const responses = await Promise.all(
    Array.from({ length: 12 }, () =>
      t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '192.0.2.222',
        payload: { email: 'ratetest@example.test', password: 'wrong password' },
      }),
    ),
  );
  expect(responses.filter((response) => response.statusCode === 401)).toHaveLength(10);
  expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(2);
});
