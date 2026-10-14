import type { FastifyInstance, FastifyReply } from 'fastify';
import { createAttemptLimiter } from '@/_utils/attempt-limiter';
import { HttpError } from '@/_utils/http-errors';
import {
  createSession,
  deleteSession,
  GUEST_SESSION_SECONDS,
  type PlayerAccount,
  readSession,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from '@/_utils/session-auth';
import type { ApiConfig } from '@/config';
import type { Database } from '@/db/database';
import {
  accountWithSetup,
  completeCharacterSetup,
  createGuest,
  loginPlayer,
  registerPlayer,
  renamePlayer,
  setUsername,
  signInWithProvider,
} from '@/modules/auth/auth-service';
import { type GoogleClient, readGoogleProfile, startGoogleSignIn } from '@/modules/auth/google-oauth';
import type { SharedState } from '@/modules/realtime/shared-state';

const OAUTH_COOKIE = 'chibi_oauth';

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: { db: Database; config: ApiConfig; clock: () => number; fetch: typeof fetch; shared: SharedState },
) {
  const { db, config, clock } = deps;
  const cookie = { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies } as const;
  const google: GoogleClient | undefined = config.google && {
    ...config.google,
    redirectUri: `${config.publicApiUrl}/auth/google/callback`,
  };

  async function signIn(reply: FastifyReply, player: PlayerAccount) {
    reply.setCookie(
      SESSION_COOKIE,
      await createSession(db, player.id, clock(), player.guest ? GUEST_SESSION_SECONDS : SESSION_SECONDS),
      {
        ...cookie,
        maxAge: player.guest ? GUEST_SESSION_SECONDS : SESSION_SECONDS,
      },
    );
    return { player: await accountWithSetup(db, player) };
  }

  const guests = createAttemptLimiter(10, 3600_000, deps.shared, 'guest-address');
  app.post('/auth/guest', async (request, reply) => {
    await deps.shared.exclusive(`guest-create:${request.ip}`, async () => {
      if (await guests.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
      await guests.fail(request.ip, clock());
    });
    reply.code(201);
    return signIn(reply, await createGuest(db, clock()));
  });
  const registrations = createAttemptLimiter(5, 86400_000, deps.shared, 'registration-address');
  app.post('/auth/register', async (request, reply) => {
    reply.code(201);
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    const player = await deps.shared.exclusive(`registration-create:${request.ip}`, async () => {
      if (await registrations.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
      const registered = await registerPlayer(db, request.body, current, clock());
      await registrations.fail(request.ip, clock());
      return registered;
    });
    return current?.guest ? { player: await accountWithSetup(db, player) } : signIn(reply, player);
  });
  /** Ten wrong passwords for one email, or thirty from one address, pause sign-in for ten minutes. */
  const byEmail = createAttemptLimiter(10, 10 * 60_000, deps.shared, 'login-email');
  const byAddress = createAttemptLimiter(30, 10 * 60_000, deps.shared, 'login-address');
  app.post('/auth/login', async (request, reply) => {
    const email = String((request.body as { email?: unknown } | null)?.email ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 254);
    if ((await byEmail.blocked(email, clock())) || (await byAddress.blocked(request.ip, clock())))
      throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
    try {
      const player = await loginPlayer(db, request.body);
      await byEmail.clear(email);
      return await signIn(reply, player);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'INVALID_CREDENTIALS') {
        await byEmail.fail(email, clock());
        await byAddress.fail(request.ip, clock());
      }
      throw error;
    }
  });
  for (const [path, operation] of [
    ['/auth/username', (id: string, body: unknown) => setUsername(db, id, body)],
    ['/player/name', (id: string, body: unknown) => renamePlayer(db, id, body, clock())],
  ] as const) {
    app.post(path, async (request) => {
      const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
      if (!current) throw new HttpError(401, 'UNAUTHENTICATED');
      return { player: await accountWithSetup(db, await operation(current.id, request.body)) };
    });
  }
  app.post('/auth/character', async (request) => {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!current) throw new HttpError(401, 'UNAUTHENTICATED');
    return { player: await completeCharacterSetup(db, current, request.body, clock()) };
  });
  app.post('/auth/logout', async (request, reply) => {
    await deleteSession(db, request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, cookie);
    return { ok: true };
  });
  /** Signed-out visitors get 200 with `player: null`, so the app can pick a screen without an error path. */
  app.get('/auth/session', async (request) => {
    const player = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    return { player: player ? await accountWithSetup(db, player) : null, providers: { google: !!google } };
  });

  app.get('/auth/google', async (_request, reply) => {
    if (!google) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
    const { url, state, verifier } = startGoogleSignIn(google);
    reply.setCookie(OAUTH_COOKIE, `${state}.${verifier}`, { ...cookie, path: '/api/auth/google', maxAge: 600 });
    return reply.redirect(url);
  });
  app.get('/auth/google/callback', async (request, reply) => {
    if (!google) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
    const query = request.query as { state?: unknown; code?: unknown };
    const [state, verifier] = (request.cookies[OAUTH_COOKIE] ?? '').split('.');
    reply.clearCookie(OAUTH_COOKIE, { ...cookie, path: '/api/auth/google' });
    try {
      if (!state || !verifier || query.state !== state || typeof query.code !== 'string')
        throw new HttpError(401, 'INVALID_CREDENTIALS');
      const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
      const player = await signInWithProvider(
        db,
        await readGoogleProfile(google, query.code, verifier, deps.fetch),
        current,
        clock(),
      );
      if (player.id !== current?.id) await signIn(reply, player);
      return reply.redirect(`${config.webOrigin}/${player.registrationBonusGranted ? '?auth=registered' : ''}`);
    } catch (error) {
      if (!(error instanceof HttpError)) request.log.error(error);
      return reply.redirect(`${config.webOrigin}/?auth=failed`);
    }
  });
}
