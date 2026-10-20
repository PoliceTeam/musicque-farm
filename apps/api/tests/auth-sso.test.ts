import { generateKeyPairSync, sign } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readConfig } from '@/config';
import { identities, players } from '@/infrastructure/database/schema';
import { signInWithSso } from '@/modules/auth/service';
import { createTestApp } from './test-app.js';

const issuer = 'https://sso.test/realms/sso';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' };
let nonce = '';
let override: Record<string, unknown> = {};
let badSignature = false;
let exchanges = 0;

function jwt() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
    iss: issuer,
    sub: 'user-1',
    aud: 'musicque-farm',
    iat: now,
    exp: now + 60,
    nonce,
    jti: 'handoff-jti',
    azp: 'musicque',
    preferred_username: 'Lan',
    ...override,
  })}`;
  const signature = sign('sha256', Buffer.from(payload), keys.privateKey).toString('base64url');
  return `${payload}.${badSignature ? 'AAAA' : signature}`;
}

const transport: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/.well-known/openid-configuration'))
    return Response.json({
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/certs`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  if (url.endsWith('/protocol/openid-connect/certs')) return Response.json({ keys: [jwk] });
  if (url.includes('/admin/realms/')) {
    expect(url.startsWith('http://sso:8080/sso/admin/realms/sso/')).toBe(true);
    if (init?.method === 'POST' || init?.method === 'PUT') return new Response(null, { status: 204 });
    return Response.json(
      url.includes('/users?')
        ? [{ id: 'user-1', username: 'lan', email: 'lan@example.test' }]
        : { id: 'user-1', username: 'lan' },
    );
  }
  if (url.endsWith('/certs')) return Response.json({ keys: [jwk] });
  if (url.endsWith('/token')) {
    exchanges++;
    const body = new URLSearchParams(String(init?.body));
    if (body.get('grant_type') === 'authorization_code') expect(body.get('code_verifier')).toBeTruthy();
    else if (body.get('password') === 'wrong') return Response.json({ error: 'invalid_grant' }, { status: 400 });
    expect(body.get('client_secret')).toBe('test-secret');
    return Response.json({
      access_token: 'access-secret',
      token_type: 'Bearer',
      expires_in: 60,
      refresh_token: 'refresh-secret',
      ...(body.get('grant_type') === 'client_credentials' ? {} : { id_token: jwt() }),
    });
  }
  throw new Error('Unexpected provider endpoint');
};

describe('Farm SSO', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    t = await createTestApp({
      config: {
        sso: {
          issuer,
          adminUrl: 'http://sso:8080/sso',
          clientId: 'musicque-farm',
          clientSecret: 'test-secret',
          tokenKey: 'ab'.repeat(32),
          targets: { musicque: 'https://musicque.test/api/auth/handoff/accept' },
          handoffOrigins: ['https://musicque.test'],
        },
      },
      fetch: transport,
    });
  });
  afterAll(() => t.close());

  async function guest() {
    const response = await t.app.inject({ method: 'POST', url: '/api/auth/guest' });
    return { id: response.json().player.id as string, cookie: t.cookieOf(response.headers) };
  }

  async function start(cookie = '', query = 'popup=1') {
    override = {};
    badSignature = false;
    const response = await t.app.inject({ url: `/api/auth/sso?${query}`, headers: { cookie } });
    expect(response.statusCode).toBe(302);
    const url = new URL(response.headers.location!);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    nonce = url.searchParams.get('nonce')!;
    const state = url.searchParams.get('state')!;
    const flowCookie = `${cookie}; ${t.cookieOf(response.headers)}`;
    return {
      url,
      state,
      cookie: flowCookie,

      callback: () =>
        t.app.inject({ url: `/api/auth/sso/callback?code=test-code&state=${state}`, headers: { cookie: flowCookie } }),
    };
  }

  async function sessionOf(response: { headers: Record<string, unknown> }) {
    const session = await t.app.inject({ url: '/api/auth/session', headers: { cookie: t.cookieOf(response.headers) } });
    return session.json();
  }

  it('upgrades the same guest, keeps its save, establishes a new cookie and never exposes tokens', async () => {
    const { id, cookie } = await guest();
    const flow = await start(cookie);
    const response = await flow.callback();
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"ok":true');
    expect(response.body).not.toContain('access-secret');
    expect((await sessionOf(response)).player).toMatchObject({ id, guest: false, username: null });
    const old = await t.app.inject({ url: '/api/auth/session', headers: { cookie } });
    expect(old.json().player).toBeNull();
    const before = exchanges;
    const replay = await flow.callback();
    expect(replay.body).toContain('"ok":false');
    expect(exchanges).toBe(before);
  });

  it.each([{ aud: 'musicque' }, { iss: 'https://impostor.test' }, { nonce: 'wrong' }, { exp: 1 }])(
    'rejects invalid ID token claims %j',
    async (claims) => {
      const flow = await start();
      override = claims;
      const response = await flow.callback();
      expect(response.body).toContain('"ok":false');
      expect(response.cookies.some((cookie) => cookie.name === 'chibi_session')).toBe(false);
    },
  );

  it('rejects forged state before exchanging code, and rejects invalid signatures', async () => {
    const flow = await start();
    const before = exchanges;
    const forged = await t.app.inject({
      url: '/api/auth/sso/callback?code=x&state=forged',
      headers: { cookie: flow.cookie },
    });
    // The attempt (and its popup mode) is unknown: report to an opener, otherwise return to the game.
    expect(forged.body).toContain('"ok":false');
    expect(forged.body).toContain('location.replace("http://game.test/?auth=sso-failed")');
    expect(exchanges).toBe(before);
    badSignature = true;
    expect((await flow.callback()).body).toContain('"ok":false');
  });

  it('binds the flow to the original local session', async () => {
    const one = await guest();
    const two = await guest();
    const flow = await start(one.cookie);
    const response = await t.app.inject({
      url: `/api/auth/sso/callback?code=x&state=${flow.state}`,
      headers: { cookie: `${two.cookie}; farm_sso_attempt=${flow.state}` },
    });
    expect(response.body).toContain('"ok":false');
  });

  it('gives a new account its SSO username when free and asks for one when it is taken', async () => {
    const first = await start('', 'popup=0');
    override = { sub: 'named-1', preferred_username: 'mai.anh' };
    const created = await first.callback();
    expect(created.headers.location).toBe('http://game.test/?auth=sso');
    expect((await sessionOf(created)).player).toMatchObject({ username: 'mai.anh', characterSetupRequired: true });
    const second = await start();
    override = { sub: 'named-2', preferred_username: 'mai.anh' };
    expect((await sessionOf(await second.callback())).player).toMatchObject({ username: null });
    const invalid = await start();
    override = { sub: 'named-3', preferred_username: 'has-dash' };
    expect((await sessionOf(await invalid.callback())).player).toMatchObject({ username: null });
  });

  it('signs a returning identity into its own player, even from another signed-in account', async () => {
    const first = await start();
    override = { sub: 'returning' };
    const owner = (await sessionOf(await first.callback())).player.id;
    const other = await start();
    override = { sub: 'someone-else' };
    const otherResponse = await other.callback();
    // Only the session cookie: the callback also clears the attempt cookie.
    const session = otherResponse.cookies.find((cookie) => cookie.name === 'chibi_session')!;
    const again = await start(`chibi_session=${session.value}`);
    override = { sub: 'returning' };
    expect((await sessionOf(await again.callback())).player.id).toBe(owner);
  });

  it('keeps redirect routes while exposing app credential forms', async () => {
    for (const url of ['/api/auth/register', '/api/auth/login'])
      expect((await t.app.inject({ method: 'POST', url, payload: {} })).statusCode).toBe(403);
    expect((await t.app.inject({ url: '/api/auth/google' })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'POST', url: '/api/auth/sso/link', payload: {} })).statusCode).toBe(404);
    const session = await t.app.inject({ url: '/api/auth/session' });
    expect(session.json().providers).toEqual({
      google: false,
      sso: true,
      accountUrl: `${issuer}/account`,
      handoffTargets: ['musicque'],
    });
    const register = await start('', 'popup=1&register=1');
    expect(register.url.searchParams.get('prompt')).toBe('create');
  });

  it('ends the app session without navigating away', async () => {
    const flow = await start();
    override = { sub: 'logout-user' };
    const signedIn = (await flow.callback()).cookies.find((item) => item.name === 'chibi_session')!;
    const cookie = `chibi_session=${signedIn.value}`;
    const foreign = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: 'http://evil.test' },
      payload: {},
    });
    expect(foreign.statusCode).toBe(403);
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: 'http://game.test' },
      payload: {},
    });
    expect(response.json().ok).toBe(true);
    const session = await t.app.inject({ url: '/api/auth/session', headers: { cookie } });
    expect(session.json().player).toBeNull();
  });

  it('limits repeated starts without deadlocking and allows retries after the window', async () => {
    for (let i = 0; i < 20; i++) {
      const response = await t.app.inject({ url: '/api/auth/sso', remoteAddress: '198.51.100.93' });
      expect(response.statusCode).toBe(302);
    }
    expect((await t.app.inject({ url: '/api/auth/sso', remoteAddress: '198.51.100.93' })).statusCode).toBe(429);
    t.advance(60_001);
    expect((await t.app.inject({ url: '/api/auth/sso', remoteAddress: '198.51.100.93' })).statusCode).toBe(302);
  });

  it('logs in with app forms, upgrades a guest, registers, resets and changes passwords', async () => {
    override = { sub: 'form-user', nonce: undefined, preferred_username: 'formuser' };
    badSignature = false;
    const { cookie, id } = await guest();

    const post = (url: string, payload: Record<string, unknown>, session = cookie) =>
      t.app.inject({
        method: 'POST',
        url: `/api/auth/${url}`,
        headers: { origin: 'http://game.test', cookie: session },
        payload,
      });

    expect((await post('login', { email: 'lan', password: 'wrong' })).statusCode).toBe(401);
    const logged = await post('login', { email: 'lan', password: 'correct horse' });
    expect(logged.statusCode).toBe(200);
    expect(logged.json().player).toMatchObject({ id, guest: false });
    const signed = t.cookieOf(logged.headers);
    expect(
      (await post('change-password', { currentPassword: 'wrong', newPassword: 'new-password' }, signed)).statusCode,
    ).toBe(401);
    expect(
      (await post('change-password', { currentPassword: 'correct horse', newPassword: 'new-password' }, signed))
        .statusCode,
    ).toBe(200);
    const known = await post('forgot-password', { identifier: 'lan' });
    const unknown = await post('forgot-password', { identifier: 'unknown' });
    expect(known.json()).toEqual(unknown.json());
    override = { sub: 'registered-form', nonce: undefined, preferred_username: 'registerform' };
    expect(
      (await post('register', { username: 'registerform', password: 'correct horse', name: 'Lan' }, '')).statusCode,
    ).toBe(201);
  });

  it.each([{ aud: 'wrong' }, { iss: 'https://evil.test' }, { exp: 1 }])(
    'rejects invalid ID tokens on password login %j',
    async (claims) => {
      override = { nonce: undefined, ...claims };
      badSignature = false;
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '198.51.100.112',
        headers: { origin: 'http://game.test' },
        payload: { email: 'lan', password: 'correct horse' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.cookies.some((item) => item.name === 'chibi_session')).toBe(false);
    },
  );
  it('rejects password login with an invalid ID signature', async () => {
    override = { nonce: undefined };
    badSignature = true;
    expect(
      (
        await t.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { origin: 'http://game.test' },
          payload: { email: 'lan', password: 'correct horse' },
        })
      ).statusCode,
    ).toBe(401);
    badSignature = false;
  });

  it('accepts handoff once, requires origin/session on outgoing, and never exposes refresh material', async () => {
    override = { sub: 'handoff-user', nonce: undefined, jti: 'handoff-good' };
    badSignature = false;

    const accept = (token: string) =>
      t.app.inject({
        method: 'POST',
        url: '/api/auth/handoff/accept',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://musicque.test' },
        payload: new URLSearchParams({ token }).toString(),
      });

    const response = await accept(jwt());
    expect(response.headers.location).toBe('http://game.test/');
    const cookie = t.cookieOf(response.headers);
    expect((await accept(jwt())).headers.location).toContain('handoff-failed');

    const outgoing = (headers: Record<string, string>) =>
      t.app.inject({ method: 'POST', url: '/api/auth/handoff', headers, payload: { target: 'musicque' } });

    expect((await outgoing({ origin: 'http://game.test' })).statusCode).toBe(401);
    expect((await outgoing({ cookie, origin: 'http://evil.test' })).statusCode).toBe(403);
    const sent = await outgoing({ cookie, origin: 'http://game.test' });
    expect(sent.statusCode).toBe(200);
    expect(sent.body).not.toContain('refresh-secret');
  });

  it.each([{ aud: 'wrong' }, { azp: 'evil' }, { exp: 1 }, { iat: 1 }, { iss: 'https://evil.test' }])(
    'rejects handoff claims %j',
    async (claims) => {
      override = { nonce: undefined, jti: `bad-${JSON.stringify(claims)}`, ...claims };
      badSignature = false;
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/auth/handoff/accept',
        headers: { origin: 'https://musicque.test' },
        payload: { token: jwt() },
      });
      expect(response.headers.location).toContain('handoff-failed');
      expect(response.cookies.some((item) => item.name === 'chibi_session')).toBe(false);
    },
  );
  it('rejects handoff with an invalid signature', async () => {
    override = { nonce: undefined };
    badSignature = true;
    expect(
      (
        await t.app.inject({
          method: 'POST',
          url: '/api/auth/handoff/accept',
          headers: { origin: 'https://musicque.test' },
          payload: { token: jwt() },
        })
      ).headers.location,
    ).toContain('handoff-failed');
    badSignature = false;
  });

  it.each([undefined, 'https://evil.test'])(
    'refuses a valid handoff posted from origin %s (login CSRF)',
    async (origin) => {
      override = { sub: 'csrf-victim', nonce: undefined, jti: `csrf-${origin}` };
      badSignature = false;
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/auth/handoff/accept',
        headers: origin ? { origin } : {},
        payload: { token: jwt() },
      });
      expect(response.headers.location).toContain('handoff-failed');
      expect(response.cookies.some((item) => item.name === 'chibi_session')).toBe(false);
    },
  );

  it('does not auto-merge an existing username and isolates identities by issuer', async () => {
    const [old] = await t.db.select().from(players).limit(1);
    const one = await signInWithSso(
      t.db,
      { issuer, subject: 'same-subject', name: 'samename', username: old.username ?? 'samename' },
      undefined,
      t.clock(),
    );
    const two = await signInWithSso(
      t.db,
      { issuer: 'https://other.test', subject: 'same-subject', name: 'samename' },
      undefined,
      t.clock(),
    );
    expect(one.id).not.toBe(old.id);
    expect(two.id).not.toBe(one.id);
    expect(await t.db.select().from(identities).where(eq(identities.subject, 'same-subject'))).toHaveLength(2);
  });
});

it('rejects partial config and insecure production issuers', () => {
  expect(() => readConfig({ DATABASE_URL: 'pglite:memory', SSO_ISSUER: issuer })).toThrow('SSO requires');
  expect(() =>
    readConfig({
      DATABASE_URL: 'pglite:memory',
      NODE_ENV: 'production',
      SSO_ISSUER: 'http://localhost:8180/realms/sso',
      SSO_CLIENT_ID: 'farm',
      SSO_CLIENT_SECRET: 'secret',
    }),
  ).toThrow('HTTPS');
});

it('scopes Farm session, SSO and Google attempt cookies to public prefixed paths', async () => {
  const t = await createTestApp({
    config: {
      webOrigin: 'https://musicque.politetech.com/farm',
      publicApiUrl: 'https://musicque.politetech.com/farm/api',
      secureCookies: true,
      sso: { issuer, clientId: 'musicque-farm', clientSecret: 'test-secret' },
    },

    fetch: async (input, init) => {
      const body = new URLSearchParams(String(init?.body));
      if (body.get('grant_type') === 'authorization_code')
        expect(body.get('redirect_uri')).toBe('https://musicque.politetech.com/farm/api/auth/sso/callback');
      return transport(input, init);
    },
  });
  try {
    const guest = await t.app.inject({ method: 'POST', url: '/api/auth/guest' });
    expect(guest.cookies.find((cookie) => cookie.name === 'chibi_session')).toMatchObject({
      path: '/farm',
      secure: true,
    });
    expect(guest.cookies.some((cookie) => cookie.name === 'musicque_session')).toBe(false);
    const start = await t.app.inject({ url: '/api/auth/sso' });
    expect(start.cookies.find((cookie) => cookie.name === 'farm_sso_attempt')).toMatchObject({
      path: '/farm/api/auth/sso',
      secure: true,
    });
    const target = new URL(start.headers.location!);
    nonce = target.searchParams.get('nonce')!;
    override = {};
    badSignature = false;
    const callback = await t.app.inject({
      url: `/api/auth/sso/callback?code=test-code&state=${target.searchParams.get('state')}`,
      headers: { cookie: t.cookieOf(start.headers) },
    });
    expect(callback.headers.location).toBe('https://musicque.politetech.com/farm/?auth=sso');
    const logout = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { origin: 'https://musicque.politetech.com' },
    });
    expect(logout.cookies.find((cookie) => cookie.name === 'chibi_session')?.path).toBe('/farm');
  } finally {
    await t.close();
  }
  const google = await createTestApp({
    config: {
      webOrigin: 'https://musicque.politetech.com/farm',
      publicApiUrl: 'https://musicque.politetech.com/farm/api',
      google: { clientId: 'google-client', clientSecret: 'google-secret' },
    },
  });
  try {
    const start = await google.app.inject({ url: '/api/auth/google' });
    expect(start.cookies.find((cookie) => cookie.name === 'chibi_oauth')?.path).toBe('/farm/api/auth/google');
  } finally {
    await google.close();
  }
});
