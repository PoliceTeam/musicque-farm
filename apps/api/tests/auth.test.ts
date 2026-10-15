import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUEST_SESSION_SECONDS, SESSION_SECONDS } from '@/_utils/session-auth';
import { playerDocuments, players, sessions } from '@/db/schema';
import { createTestApp } from './test-app.js';

describe('accounts and sessions', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  let address = 0;

  const post = (url: string, payload: unknown, cookie = '') =>
    t.app.inject({
      method: 'POST',
      url,
      remoteAddress: `198.51.100.${++address}`,
      payload: payload as object,
      headers: { cookie },
    });

  const session = async (cookie: string) =>
    (await t.app.inject({ url: '/api/auth/session', headers: { cookie } })).json();

  it('registers, reports the session and signs out', async () => {
    const { cookie, player } = await t.register('lan');
    expect(player.name).toBe('lan');
    expect(await session(cookie)).toEqual({ player: { ...player, level: 1 }, providers: { google: false } });
    expect((await post('/api/auth/logout', {}, cookie)).statusCode).toBe(200);
    expect((await session(cookie)).player).toBeNull();
  });

  it('registers distinct username-only accounts and logs in without email', async () => {
    for (const [username, email] of [
      ['noemail1', undefined],
      ['noemail2', ''],
    ] as const) {
      const response = await post('/api/auth/register', {
        username,
        email,
        name: 'No Email',
        password: 'correct horse',
      });
      expect(response.statusCode).toBe(201);
      const login = await post('/api/auth/login', { email: username, password: 'correct horse' });
      expect(login.statusCode).toBe(200);
      expect(login.json().player.username).toBe(username);
      const [row] = await t.db.select().from(players).where(eq(players.username, username));
      expect(row.email).toBeNull();
    }
    const invalid = await post('/api/auth/register', {
      username: 'badmail',
      email: 'invalid',
      name: 'Valid',
      password: 'correct horse',
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('stores signup appearance atomically and excludes special sets', async () => {
    const response = await post('/api/auth/register', {
      username: 'customfemale',
      name: 'Custom',
      password: 'correct horse',
      outfit: {
        gender: 'female',
        hair: 'hair.female-low-ponytail',
        shirtColor: 'Hồng',
        held: 'held.nyoibo',
        back: 'wings.angel',
      },
    });
    expect(response.statusCode).toBe(201);
    const [row] = await t.db
      .select()
      .from(playerDocuments)
      .where(eq(playerDocuments.playerId, response.json().player.id));
    expect(row.document.outfit).toMatchObject({
      gender: 'female',
      hair: 'hair.female-low-ponytail',
      held: '',
      back: '',
    });
    const male = await post('/api/auth/register', {
      username: 'custommale',
      name: 'Custom',
      password: 'correct horse',
      outfit: { gender: 'male', hair: 'hair.goku', shirt: 'shirt.goku', pants: 'pants.goku', shoes: 'boots' },
    });
    expect(male.statusCode).toBe(201);
    const [maleRow] = await t.db
      .select()
      .from(playerDocuments)
      .where(eq(playerDocuments.playerId, male.json().player.id));
    expect(JSON.stringify(maleRow.document.outfit)).not.toContain('goku');
    expect(maleRow.document.outfit?.shoes).not.toBe('boots');
  });

  it('keeps the post-signup character step pending across sessions and completes it once', async () => {
    const response = await post('/api/auth/register', {
      username: 'setup_once',
      name: 'Setup',
      password: 'correct horse',
    });
    const cookie = t.cookieOf(response.headers);
    expect(response.json().player.characterSetupRequired).toBe(true);
    expect((await session(cookie)).player.characterSetupRequired).toBe(true);
    const saved = await post(
      '/api/auth/character',
      { outfit: { gender: 'female', hair: 'hair.female-low-ponytail' } },
      cookie,
    );
    expect(saved.statusCode).toBe(200);
    expect((await session(cookie)).player.characterSetupRequired).toBeUndefined();
    await post('/api/auth/character', { outfit: { gender: 'male' } }, cookie);
    const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, saved.json().player.id));
    expect(row.document.outfit?.gender).toBe('female');
    const login = await post('/api/auth/login', { email: 'setup_once', password: 'correct horse' });
    expect(login.json().player.characterSetupRequired).toBeUndefined();
  });

  it('sets an http-only cookie and never returns the password hash', async () => {
    const response = await post('/api/auth/register', {
      email: 'Cookie@Example.test',
      password: 'correct horse',
      name: 'Cookie',
      username: 'cookie',
    });
    expect(String(response.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(response.headers['set-cookie'])).toMatch(/SameSite=Lax/i);
    expect(response.body).not.toMatch(/scrypt|password/);
  });

  it('logs in with the right password only, ignoring email case', async () => {
    await t.register('minh');
    const ok = await post('/api/auth/login', { email: 'MINH@example.test', password: 'correct horse' });
    expect(ok.statusCode).toBe(200);
    expect((await session(t.cookieOf(ok.headers))).player.name).toBe('minh');
    for (const body of [
      { email: 'minh@example.test', password: 'wrong password' },
      { email: 'nobody@example.test', password: 'correct horse' },
      { email: 'minh@example.test' },
      null,
    ]) {
      const denied = await post('/api/auth/login', body);
      expect(denied.statusCode).toBe(401);
      expect(denied.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
    }
  });

  it('pauses sign-in for an email after ten wrong passwords, then allows it again', async () => {
    await t.register('guess');

    const attempt = (password: string) => post('/api/auth/login', { email: 'guess@example.test', password });

    for (let i = 0; i < 10; i++) expect((await attempt(`wrong-${i}`)).statusCode).toBe(401);
    const blocked = await attempt('correct horse');
    expect([blocked.statusCode, blocked.json()]).toEqual([429, { code: 'TOO_MANY_ATTEMPTS' }]);
    t.advance(10 * 60_000 + 1);
    expect((await attempt('correct horse')).statusCode).toBe(200);
    // A success clears the count, so nine later mistakes do not add up with earlier ones.
    for (let i = 0; i < 9; i++) await attempt('wrong');
    expect((await attempt('correct horse')).statusCode).toBe(200);
  });

  it('rejects a duplicate email and invalid input', async () => {
    await t.register('trang');
    const duplicate = await post('/api/auth/register', {
      email: 'TRANG@example.test',
      password: 'another password',
      name: 'Other',
      username: 'other',
    });
    expect([duplicate.statusCode, duplicate.json()]).toEqual([409, { code: 'EMAIL_TAKEN' }]);
    for (const body of [
      { email: 'not-an-email', password: 'correct horse', name: 'Valid' },
      { email: 'a@example.test', password: 'short', name: 'Valid' },
      { email: 'b@example.test', password: 'correct horse', name: 'x' },
      { email: 'c@example.test', password: 'correct horse', name: 'x'.repeat(21) },
    ])
      expect((await post('/api/auth/register', body)).json()).toEqual({ code: 'INVALID_INPUT' });
  });

  it('requires a session for game routes and expires it', async () => {
    const anonymous = await t.app.inject({ url: '/api/player' });
    expect([anonymous.statusCode, anonymous.json()]).toEqual([401, { code: 'UNAUTHENTICATED' }]);
    expect((await t.app.inject({ url: '/api/player', headers: { cookie: 'chibi_session=forged' } })).statusCode).toBe(
      401,
    );
    const { cookie } = await t.register('expiry');
    expect((await t.app.inject({ url: '/api/player', headers: { cookie } })).statusCode).toBe(200);
    t.advance(SESSION_SECONDS * 1000 + 1);
    expect((await t.app.inject({ url: '/api/player', headers: { cookie } })).statusCode).toBe(401);
  });

  it('creates a fresh guest with a one-year cookie and limits creation per address for one hour', async () => {
    const results = await Promise.all(
      Array.from({ length: 11 }, () =>
        t.app.inject({ method: 'POST', url: '/api/auth/guest', remoteAddress: '192.0.2.5', payload: {} }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(10);
    expect(results.find((r) => r.statusCode === 429)?.json()).toEqual({ code: 'TOO_MANY_ATTEMPTS' });
    const first = results.find((r) => r.statusCode === 201)!;
    expect(first.json().player).toMatchObject({ guest: true, level: 1 });
    expect(first.json().player.name).toMatch(/^Khách\d{4}$/);
    expect(String(first.headers['set-cookie'])).toContain(`Max-Age=${GUEST_SESSION_SECONDS}`);
    const cookie = t.cookieOf(first.headers);
    const [row] = await t.db.select().from(sessions).where(eq(sessions.playerId, first.json().player.id));
    expect(row.expiresAt.getTime()).toBe(t.clock() + GUEST_SESSION_SECONDS * 1000);
    expect((await session(cookie)).player).toEqual(first.json().player);
    t.advance(3600_000);
    expect(
      (await t.app.inject({ method: 'POST', url: '/api/auth/guest', remoteAddress: '192.0.2.5', payload: {} }))
        .statusCode,
    ).toBe(201);
  });

  it('upgrades the same guest with farm progress and session intact', async () => {
    const guest = await post('/api/auth/guest', {});
    const cookie = t.cookieOf(guest.headers);
    const sdk = t.sdkFor(cookie);
    await sdk.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'home' });
    const command = await sdk.execute({
      type: 'plot',
      action: 'till',
      index: 0,
      mapInstanceId: 'home',
      requestId: 'guest-till',
    });
    const upgraded = await post(
      '/api/auth/register',
      { name: 'Saved guest', username: 'saved_guest', email: 'saved@example.test', password: 'correct horse' },
      cookie,
    );
    expect(upgraded.statusCode).toBe(201);
    expect(upgraded.json().player).toMatchObject({ id: guest.json().player.id, guest: false, name: 'Saved guest' });
    expect(upgraded.headers['set-cookie']).toBeUndefined();
    expect((await session(cookie)).player.guest).toBe(false);
    expect((await sdk.getInventory()).farm).toEqual({
      ...command.farm,
      coins: command.farm.coins + 50_000,
      gems: command.farm.gems + 20,
    });
    const login = await post('/api/auth/login', { email: 'saved@example.test', password: 'correct horse' });
    expect(login.json().player.id).toBe(guest.json().player.id);
  });

  it('switches from a guest to an existing account without merging progress', async () => {
    const existing = await t.register('switch');
    const guest = await post('/api/auth/guest', {});
    const cookie = t.cookieOf(guest.headers);
    const sdk = t.sdkFor(cookie);
    await sdk.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'home' });
    const changed = await sdk.execute({
      type: 'plot',
      action: 'till',
      index: 0,
      mapInstanceId: 'home',
      requestId: 'switch-till',
    });
    const login = await post('/api/auth/login', { email: 'switch@example.test', password: 'correct horse' }, cookie);
    expect(login.json().player).toMatchObject({ id: existing.player.id, guest: false });
    expect((await t.sdkFor(t.cookieOf(login.headers)).getInventory()).farm.plots[0]).not.toEqual(changed.farm.plots[0]);
    expect((await session(cookie)).player.guest).toBe(true);
  });

  it('throttles last_seen writes and cleans only guests inactive over 30 days', async () => {
    const guest = await post('/api/auth/guest', {});
    const id = guest.json().player.id;
    const cookie = t.cookieOf(guest.headers);

    const lastSeen = async () => (await t.db.select().from(players).where(eq(players.id, id)))[0].lastSeenAt.getTime();

    const initial = await lastSeen();
    t.advance(30 * 60_000);
    await session(cookie);
    expect(await lastSeen()).toBe(initial);
    t.advance(31 * 60_000);
    await t.app.inject({ url: '/api/player', headers: { cookie } });
    expect(await lastSeen()).toBe(t.clock());
    const regular = await t.register('retained');
    t.advance(30 * 86400_000 + 1);
    const active = await post('/api/auth/guest', {});
    await t.tables.sweep();
    expect((await session(cookie)).player).toBeNull();
    expect(await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, id))).toHaveLength(0);
    expect(await t.db.select().from(sessions).where(eq(sessions.playerId, id))).toHaveLength(0);
    expect(
      await t.db
        .select()
        .from(players)
        .where(and(eq(players.id, regular.player.id), eq(players.guest, false))),
    ).toHaveLength(1);
    expect((await session(t.cookieOf(active.headers))).player.guest).toBe(true);
  });

  it('answers CORS only for the game origin', async () => {
    const allowed = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/commands',
      headers: { origin: 'http://game.test' },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://game.test');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const other = await t.app.inject({ url: '/api/auth/session', headers: { origin: 'http://evil.test' } });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Google sign-in', () => {
  const google = { clientId: 'client', clientSecret: 'secret' };
  const profile = { sub: 'g-1', email: 'Hoa@Example.test', email_verified: true, name: 'Hoa Nguyen' };

  async function flow(user: object, existing?: (t: Awaited<ReturnType<typeof createTestApp>>) => Promise<unknown>) {
    const calls: { url: string; body: string }[] = [];
    const t = await createTestApp({
      config: { google },

      fetch: async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body ?? '') });
        return new Response(JSON.stringify(String(url).includes('/token') ? { access_token: 'at' } : user));
      },
    });
    await existing?.(t);
    const start = await t.app.inject({ url: '/api/auth/google' });
    const target = new URL(String(start.headers.location));

    const callback = (state: string, cookie = t.cookieOf(start.headers)) =>
      t.app.inject({ url: `/api/auth/google/callback?code=abc&state=${state}`, headers: { cookie } });

    return { t, start, target, callback, calls };
  }

  it('is unavailable until configured', async () => {
    const t = await createTestApp();
    expect((await t.app.inject({ url: '/api/auth/google' })).statusCode).toBe(404);
    await t.close();
  });

  it('creates an account on first sign-in and reuses it afterwards', async () => {
    const { t, start, target, callback, calls } = await flow(profile);
    expect(start.statusCode).toBe(302);
    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(target.searchParams.get('redirect_uri')).toBe('http://api.test/api/auth/google/callback');
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    const done = await callback(target.searchParams.get('state')!);
    expect(done.headers.location).toBe('http://game.test/?auth=registered');
    expect(calls[0].body).toContain('code_verifier=');
    const cookie = t.cookieOf(done.headers);
    const first = (await t.app.inject({ url: '/api/auth/session', headers: { cookie } })).json().player;
    expect(first.name).toBe('Hoa Nguyen');
    expect((await t.app.inject({ url: '/api/player', headers: { cookie } })).statusCode).toBe(200);

    const again = await t.app.inject({ url: '/api/auth/google' });
    const second = await t.app.inject({
      url: `/api/auth/google/callback?code=abc&state=${new URL(String(again.headers.location)).searchParams.get('state')}`,
      headers: { cookie: t.cookieOf(again.headers) },
    });
    const player = (
      await t.app.inject({ url: '/api/auth/session', headers: { cookie: t.cookieOf(second.headers) } })
    ).json().player;
    expect(player.id).toBe(first.id);
    await t.close();
  });

  it('links a new Google identity to the current guest but switches for known identities or emails', async () => {
    const f = await flow(profile);

    const guest = async () => {
      const response = await f.t.app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
      return { cookie: f.t.cookieOf(response.headers), player: response.json().player };
    };

    const first = await guest();
    const sdk = f.t.sdkFor(first.cookie);
    await sdk.getMap({ regionId: 'farm', mapId: 'farm-home', instanceId: 'home' });
    const changed = await sdk.execute({
      type: 'plot',
      action: 'till',
      index: 0,
      mapInstanceId: 'home',
      requestId: 'google-till',
    });
    const done = await f.callback(
      f.target.searchParams.get('state')!,
      `${f.t.cookieOf(f.start.headers)}; ${first.cookie}`,
    );
    const cookie = first.cookie;
    expect(String(done.headers['set-cookie'])).not.toContain('chibi_session=');
    const player = (await f.t.app.inject({ url: '/api/auth/session', headers: { cookie } })).json().player;
    expect(player).toMatchObject({ id: first.player.id, guest: false });
    expect((await f.t.sdkFor(cookie).getInventory()).farm).toEqual({
      ...changed.farm,
      coins: changed.farm.coins + 50_000,
      gems: changed.farm.gems + 20,
    });
    const second = await guest();
    const known = await f.callback(
      f.target.searchParams.get('state')!,
      `${f.t.cookieOf(f.start.headers)}; ${second.cookie}`,
    );
    expect(
      (await f.t.app.inject({ url: '/api/auth/session', headers: { cookie: f.t.cookieOf(known.headers) } })).json()
        .player.id,
    ).toBe(first.player.id);
    await f.t.close();

    let accountId = '';
    const email = await flow({ ...profile, sub: 'new-subject' }, async (t) => {
      accountId = (await t.register('hoa')).player.id;
    });
    const other = await email.t.app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    const switched = await email.callback(
      email.target.searchParams.get('state')!,
      `${email.t.cookieOf(email.start.headers)}; ${email.t.cookieOf(other.headers)}`,
    );
    expect(
      (
        await email.t.app.inject({ url: '/api/auth/session', headers: { cookie: email.t.cookieOf(switched.headers) } })
      ).json().player.id,
    ).toBe(accountId);
    await email.t.close();
  });

  it('rejects a mismatched state without calling Google', async () => {
    const { t, callback, calls } = await flow(profile);
    const done = await callback('forged');
    expect(done.headers.location).toBe('http://game.test/?auth=failed');
    expect(done.headers['set-cookie']).not.toMatch(/chibi_session=\w/);
    expect(calls).toHaveLength(0);
    await t.close();
  });

  it('links a verified email to the existing account and refuses an unverified one', async () => {
    let existingId = '';
    const linked = await flow(profile, async (t) => {
      existingId = (await t.register('hoa')).player.id;
    });
    const done = await linked.callback(linked.target.searchParams.get('state')!);
    const session = await linked.t.app.inject({
      url: '/api/auth/session',
      headers: { cookie: linked.t.cookieOf(done.headers) },
    });
    expect(session.json().player.id).toBe(existingId);
    await linked.t.close();

    const unverified = await flow({ ...profile, email_verified: false }, (t) => t.register('hoa'));
    const refused = await unverified.callback(unverified.target.searchParams.get('state')!);
    expect(refused.headers.location).toBe('http://game.test/?auth=failed');
    await unverified.t.close();
  });
});
