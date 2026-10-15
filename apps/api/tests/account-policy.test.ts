import {
  REGISTRATION_BONUS_COINS,
  REGISTRATION_BONUS_GEMS,
  SERVER_STARTING_COINS,
  SERVER_STARTING_GEMS,
} from '@chibi-town/game-content';
import { createPlayerDocument } from '@chibi-town/game-service';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { playerDocuments, players } from '@/infrastructure/database/schema';
import { signInWithProvider } from '@/modules/auth/service';
import { createTestApp } from './test-app.js';

describe('server account policy', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  const post = (url: string, payload: object, cookie = '', remoteAddress = '203.0.113.1') =>
    t.app.inject({ method: 'POST', url, payload, headers: { cookie }, remoteAddress });

  const registration = (username = 'sample', email = `${username}@example.test`) => ({
    email,
    username,
    name: 'Same name',
    password: 'correct horse',
  });

  const guest = async () => {
    const response = await post('/api/auth/guest', {});
    return { player: response.json().player, cookie: t.cookieOf(response.headers) };
  };

  const wallet = async (id: string) =>
    (await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, id)))[0].document.farm;

  const row = async (id: string) => (await t.db.select().from(players).where(eq(players.id, id)))[0];

  const registeredBalance = {
    coins: SERVER_STARTING_COINS + REGISTRATION_BONUS_COINS,
    gems: SERVER_STARTING_GEMS + REGISTRATION_BONUS_GEMS,
  };
  const profile = {
    provider: 'google' as const,
    subject: 'new-google',
    email: 'google@example.test',
    emailVerified: true,
    name: 'Google player',
  };

  it('starts guests and local players with the shared starting balance', async () => {
    const { player, cookie } = await guest();
    expect(player.username).toBeNull();
    expect(await wallet(player.id)).toMatchObject({ coins: 30_000, gems: 0 });
    expect((await row(player.id)).registrationBonusAt).toBeNull();
    expect(createPlayerDocument().farm.coins).toBe(30_000);
    expect((await t.sdkFor(cookie).getPlayer()).username).toBeNull();
  });

  it('pays direct registration once, including duplicate retries and re-logins', async () => {
    const response = await post('/api/auth/register', registration());
    expect(response.statusCode).toBe(201);
    const id = response.json().player.id;
    expect(await wallet(id)).toMatchObject(registeredBalance);
    expect((await row(id)).registrationBonusAt?.getTime()).toBe(t.clock());
    for (let i = 0; i < 2; i++) {
      expect((await post('/api/auth/register', registration())).statusCode).toBe(409);
      expect((await post('/api/auth/login', { email: 'SAMPLE', password: 'correct horse' })).json().player.id).toBe(id);
    }
    expect(await wallet(id)).toMatchObject(registeredBalance);
    expect(await t.db.select().from(players)).toHaveLength(1);
  });

  it('upgrades and awards a guest only once under concurrent retries, preserving saved progress', async () => {
    const { player, cookie } = await guest();
    const [saved] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, player.id));
    saved.document.farm.coins = 12_345;
    saved.document.farm.gems = 7;
    await t.db.update(playerDocuments).set({ document: saved.document }).where(eq(playerDocuments.playerId, player.id));
    const results = await Promise.all(
      Array.from({ length: 3 }, () => post('/api/auth/register', registration(), cookie)),
    );
    expect(results.filter((result) => result.statusCode === 201)).toHaveLength(1);
    expect(await wallet(player.id)).toMatchObject({ coins: 62_345, gems: 27 });
    expect((await row(player.id)).guest).toBe(false);
    await post('/api/auth/register', registration(), cookie);
    expect(await wallet(player.id)).toMatchObject({ coins: 62_345, gems: 27 });
  });

  it('pays Google once and leaves the username for the required popup step', async () => {
    const callbacks = await Promise.all([
      signInWithProvider(t.db, profile, undefined, t.clock()),
      signInWithProvider(t.db, profile, undefined, t.clock()),
    ]);
    expect(callbacks[0].id).toBe(callbacks[1].id);
    const player = callbacks[0];
    expect(player.username).toBeNull();
    expect(await wallet(player.id)).toMatchObject(registeredBalance);
    expect((await row(player.id)).usernameRequired).toBe(true);
    const again = await signInWithProvider(t.db, profile, undefined, t.clock());
    expect(again.username).toBeNull();
    expect(await wallet(player.id)).toMatchObject(registeredBalance);
    // HTTP session and the once-only endpoint expose the same account.
    const { createSession } = await import('@/_utils/session-auth');
    const cookie = `chibi_session=${await createSession(t.db, player.id, t.clock())}`;
    const session = await t.app.inject({ url: '/api/auth/session', headers: { cookie } });
    expect(session.json().player.username).toBeNull();
    expect((await post('/api/auth/username', { username: 'GOOGLE.user' }, cookie)).json().player.username).toBe(
      'google.user',
    );
    expect((await post('/api/auth/username', { username: 'changed' }, cookie)).json()).toEqual({
      code: 'USERNAME_IMMUTABLE',
    });
    expect((await t.sdkFor(cookie).getPlayer()).username).toBe('google.user');
    expect(await wallet(player.id)).toMatchObject(registeredBalance);
  });

  it('awards Google guest upgrades once and does not repay existing email links', async () => {
    const { player } = await guest();
    const first = await signInWithProvider(t.db, profile, player, t.clock());
    expect(first.id).toBe(player.id);
    expect(await wallet(player.id)).toMatchObject(registeredBalance);
    await signInWithProvider(t.db, profile, player, t.clock());
    await signInWithProvider(t.db, { ...profile, subject: 'second-identity' }, undefined, t.clock());
    expect(await wallet(player.id)).toMatchObject(registeredBalance);
  });

  it('allows only five direct registrations or upgrades per address per day, including concurrent requests', async () => {
    const first = await guest();
    const requests = [
      post('/api/auth/register', registration('upgrade'), first.cookie),
      ...Array.from({ length: 6 }, (_, i) => post('/api/auth/register', registration(`limit${i}`))),
    ];
    const results = await Promise.all(requests);
    expect(results.filter((response) => response.statusCode === 201)).toHaveLength(5);
    expect(results.filter((response) => response.statusCode === 429)).toHaveLength(2);
    expect(results.filter((response) => response.statusCode === 429).map((response) => response.json())).toEqual([
      { code: 'TOO_MANY_ATTEMPTS' },
      { code: 'TOO_MANY_ATTEMPTS' },
    ]);
    expect((await post('/api/auth/register', registration('otheraddress'), '', '203.0.113.2')).statusCode).toBe(201);
    t.advance(86400_000);
    expect((await post('/api/auth/register', registration('tomorrow'))).statusCode).toBe(201);
  });

  it('requires valid usernames, stores lowercase, permits duplicate display names and rejects taken handles', async () => {
    for (const username of [undefined, '', 'ab', '_abc', '.abc', 'has space', 'has-dash', 'café', 'x'.repeat(21)]) {
      expect((await post('/api/auth/register', { ...registration(), username })).json()).toEqual({
        code: 'INVALID_INPUT',
      });
    }
    const first = await post('/api/auth/register', registration('ALICE.01'));
    expect(first.json().player.username).toBe('alice.01');
    expect((await post('/api/auth/register', registration('alice.01', 'different@example.test'))).json()).toEqual({
      code: 'USERNAME_TAKEN',
    });
    const second = await post('/api/auth/register', registration('bob_02'));
    expect(second.json().player.name).toBe(first.json().player.name);
    const login = await post('/api/auth/login', { email: 'ALICE.01', password: 'correct horse' });
    expect(login.json().player).toEqual(first.json().player);
    expect(login.body).not.toMatch(/passwordHash|registrationBonusAt/);
    expect((await post('/api/auth/username', { username: 'newname' }, t.cookieOf(login.headers))).json()).toEqual({
      code: 'USERNAME_IMMUTABLE',
    });
  });

  it('resolves taken Google usernames without changing another account', async () => {
    await post('/api/auth/register', registration('taken'));
    const player = await signInWithProvider(t.db, profile, undefined, t.clock());
    const { createSession } = await import('@/_utils/session-auth');
    const cookie = `chibi_session=${await createSession(t.db, player.id, t.clock())}`;
    expect((await post('/api/auth/username', { username: 'TAKEN' }, cookie)).json()).toEqual({
      code: 'USERNAME_TAKEN',
    });
    expect((await row(player.id)).username).toBeNull();
    const concurrent = await Promise.all(
      ['first_name', 'second_name'].map((username) => post('/api/auth/username', { username }, cookie)),
    );
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });

  it('assigns legacy usernames at sign-in with normalisation and numeric collision suffixes', async () => {
    await post('/api/auth/register', registration('legacyperson'));
    const old = await t.register('legacy-person');
    await t.db.update(players).set({ username: null, usernameRequired: false }).where(eq(players.id, old.player.id));
    const login = await post('/api/auth/login', { email: 'legacy-person@example.test', password: 'correct horse' });
    expect(login.json().player.username).toBe('legacyperson1');
    expect(
      (await post('/api/auth/login', { email: 'legacyperson1', password: 'correct horse' })).json().player.id,
    ).toBe(old.player.id);
    expect(await wallet(old.player.id)).toMatchObject(registeredBalance);
  });

  it('validates display names, permits a first change for guests and blocks concurrent changes for exactly seven days', async () => {
    const { player, cookie } = await guest();
    for (const name of ['', ' x ', 'x'.repeat(21)])
      expect((await post('/api/player/name', { name }, cookie)).json()).toEqual({ code: 'INVALID_INPUT' });
    const changed = await post('/api/player/name', { name: '  New name  ' }, cookie);
    expect(changed.json().player).toMatchObject({ id: player.id, name: 'New name', username: null });
    const nextAllowedAt = t.clock() + 7 * 86400_000;
    expect((await post('/api/player/name', { name: 'Another name' }, cookie)).json()).toEqual({
      code: 'RENAME_TOO_SOON',
      nextAllowedAt,
    });
    t.advance(7 * 86400_000 - 1);
    expect((await post('/api/player/name', { name: 'Too soon' }, cookie)).statusCode).toBe(429);
    t.advance(1);
    const concurrent = await Promise.all(
      ['Allowed now', 'Cannot race'].map((name) => post('/api/player/name', { name }, cookie)),
    );
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 429]);
    expect((await t.sdkFor(cookie).getPlayer()).name).toBe('Allowed now');
    expect((await post('/api/player/name', { name: 'Without cookie' })).statusCode).toBe(401);
  });

  it('blocks guests at every peer wager game but permits every practice game and both house games', async () => {
    const { cookie } = await guest();
    const starts = [
      { path: '/arcade/diamonds/start', gameId: 'diamonds' },
      { path: '/arcade/tien-len/start', gameId: 'tien-len' },
      { path: '/arcade/phom/start', gameId: 'phom' },
      { path: '/arcade/mini/chess/start', gameId: 'chess' },
      { path: '/arcade/mini/chinese-chess/start', gameId: 'chinese-chess' },
    ];
    for (const [i, { path, gameId }] of starts.entries()) {
      for (const roomId of [0, 1, 2]) {
        const blocked = await post(
          `/api${path}`,
          { gameId, roomId, tableId: 0, requestId: `blocked-${i}-${roomId}`, prepare: true },
          cookie,
        );
        expect([blocked.statusCode, blocked.json()]).toEqual([403, { code: 'ACCOUNT_REQUIRED' }]);
      }
      const practice = await post(
        `/api${path}`,
        { gameId, roomId: 3, tableId: 0, requestId: `practice-${i}`, prepare: true },
        cookie,
      );
      expect(practice.statusCode).toBe(200);
      const whilePracticing = await post(
        `/api${path}`,
        { gameId, roomId: 0, requestId: `blocked-after-practice-${i}`, prepare: true },
        cookie,
      );
      expect([whilePracticing.statusCode, whilePracticing.json()]).toEqual([403, { code: 'ACCOUNT_REQUIRED' }]);
    }
    for (const gameId of ['bau-cua', 'slots']) {
      expect(
        (
          await post(
            `/api/arcade/mini/${gameId}/start`,
            { gameId, roomId: 0, requestId: `house-${gameId}`, prepare: true },
            cookie,
          )
        ).statusCode,
      ).toBe(200);
    }
    expect(await wallet((await t.sdkFor(cookie).getPlayer()).id)).toMatchObject({ coins: 30_000, gems: 0 });
  });

  it('includes immutable handles in peer table payloads and refreshes changed display names', async () => {
    const [a, b] = await Promise.all([t.register('alice'), t.register('bobby')]);
    const sdkA = t.sdkFor(a.cookie);
    const sdkB = t.sdkFor(b.cookie);
    await sdkA.startTienRoom({ roomId: 0, requestId: 'alice-seat', prepare: true });
    const table = await sdkB.startTienRoom({ roomId: 0, requestId: 'bob-seat', prepare: true });
    expect(table.players?.map((player) => player.username)).toEqual(['bobby', 'alice']);
    await post('/api/player/name', { name: 'alice' }, b.cookie);
    const refreshed = (await sdkA.getTienLobby()).activeMatch;
    expect(refreshed?.players?.map((player) => [player.name, player.username])).toEqual([
      ['alice', 'alice'],
      ['alice', 'bobby'],
    ]);
  });
});
