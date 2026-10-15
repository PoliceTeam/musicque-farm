import type { FastifyReply, FastifyRequest } from 'fastify';
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
import type { Database } from '@/infrastructure/database/database';
import type { SharedState } from '@/infrastructure/realtime/shared-state';
import { type GoogleClient, readGoogleProfile, startGoogleSignIn } from '@/modules/auth/google-oauth';
import {
  accountWithSetup,
  completeCharacterSetup,
  createGuest as createGuestPlayer,
  loginPlayer,
  registerPlayer,
  renamePlayer,
  setUsername,
  signInWithProvider,
} from '@/modules/auth/service';

const OAUTH_COOKIE = 'chibi_oauth';

export function createAuthController(deps: {
  db: Database;
  config: ApiConfig;
  clock: () => number;
  fetch: typeof fetch;
  shared: SharedState;
}) {
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

  const createGuest = async (request: FastifyRequest, reply: FastifyReply) => {
    await deps.shared.exclusive(`guest-create:${request.ip}`, async () => {
      if (await guests.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
      await guests.fail(request.ip, clock());
    });
    reply.code(201);
    return signIn(reply, await createGuestPlayer(db, clock()));
  };

  const registrations = createAttemptLimiter(5, 86400_000, deps.shared, 'registration-address');

  const register = async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    const player = await deps.shared.exclusive(`registration-create:${request.ip}`, async () => {
      if (await registrations.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
      const registered = await registerPlayer(db, request.body, current, clock());
      await registrations.fail(request.ip, clock());
      return registered;
    });
    return current?.guest ? { player: await accountWithSetup(db, player) } : signIn(reply, player);
  };

  /** Ten wrong passwords for one email, or thirty from one address, pause sign-in for ten minutes. */
  const byEmail = createAttemptLimiter(10, 10 * 60_000, deps.shared, 'login-email');
  const byAddress = createAttemptLimiter(30, 10 * 60_000, deps.shared, 'login-address');

  const login = async (request: FastifyRequest, reply: FastifyReply) => {
    const email = String((request.body as { email?: unknown } | null)?.email ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 254);
    return deps.shared.exclusive(`login-attempt-address:${request.ip}`, () =>
      deps.shared.exclusive(`login-attempt-email:${email}`, async () => {
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
      }),
    );
  };

  async function updateUsername(request: FastifyRequest) {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!current) throw new HttpError(401, 'UNAUTHENTICATED');
    return { player: await accountWithSetup(db, await setUsername(db, current.id, request.body)) };
  }

  async function rename(request: FastifyRequest) {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!current) throw new HttpError(401, 'UNAUTHENTICATED');
    return { player: await accountWithSetup(db, await renamePlayer(db, current.id, request.body, clock())) };
  }

  const completeCharacter = async (request: FastifyRequest) => {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!current) throw new HttpError(401, 'UNAUTHENTICATED');
    return { player: await completeCharacterSetup(db, current, request.body, clock()) };
  };

  const logout = async (request: FastifyRequest, reply: FastifyReply) => {
    await deleteSession(db, request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, cookie);
    return { ok: true };
  };

  const session = async (request: FastifyRequest) => {
    const player = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    return { player: player ? await accountWithSetup(db, player) : null, providers: { google: !!google } };
  };

  const googleSignIn = async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!google) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
    const { url, state, verifier } = startGoogleSignIn(google);
    reply.setCookie(OAUTH_COOKIE, `${state}.${verifier}`, { ...cookie, path: '/api/auth/google', maxAge: 600 });
    return reply.redirect(url);
  };

  const googleCallback = async (request: FastifyRequest, reply: FastifyReply) => {
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
      if (player.id !== current?.id) await deleteSession(db, request.cookies[SESSION_COOKIE]);
      if (player.id !== current?.id || !(await readSession(db, request.cookies[SESSION_COOKIE], clock())))
        await signIn(reply, player);
      return reply.redirect(`${config.webOrigin}/${player.registrationBonusGranted ? '?auth=registered' : ''}`);
    } catch (error) {
      if (!(error instanceof HttpError)) request.log.error(error);
      return reply.redirect(`${config.webOrigin}/?auth=failed`);
    }
  };

  return {
    createGuest,
    register,
    login,
    updateUsername,
    rename,
    completeCharacter,
    logout,
    session,
    googleSignIn,
    googleCallback,
  };
}
