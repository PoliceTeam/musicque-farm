import { and, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createAttemptLimiter } from '@/_utils/attempt-limiter';
import { HttpError } from '@/_utils/http-errors';
import { hashSessionToken, readSession, SESSION_COOKIE } from '@/_utils/session-auth';
import { identities, sessions } from '@/infrastructure/database/schema';
import { signInWithSso } from './service';
import type { createSsoController } from './sso-controller';
import { createPasswordProvider } from './sso-password';

export function createSsoFormsController(deps: Parameters<typeof createSsoController>[0]) {
  const { config, db, clock, shared } = deps;
  const provider = config.sso && createPasswordProvider(config.sso, deps.fetch, config.webOrigin);

  function passwords() {
    if (!provider) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
    return provider;
  }

  function origin(request: FastifyRequest) {
    if (request.headers.origin !== new URL(config.webOrigin).origin) throw new HttpError(403, 'INVALID_INPUT');
  }

  async function requireCurrent(request: FastifyRequest) {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!current || current.guest) throw new HttpError(401, 'UNAUTHENTICATED');
    return current;
  }

  async function establish(
    request: FastifyRequest,
    reply: FastifyReply,
    result: Awaited<ReturnType<ReturnType<typeof passwords>['login']>>,
  ) {
    const current = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    const player = await signInWithSso(db, result.profile, current, clock());
    await deps.revokeCookie(request);
    return deps.signIn(reply, player, result.refresh);
  }

  const limiter = createAttemptLimiter(30, 10 * 60_000, shared, 'sso-forms');

  async function limit(request: FastifyRequest) {
    origin(request);
    await shared.exclusive(`sso-forms-lock:${request.ip}`, async () => {
      if (await limiter.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
      await limiter.fail(request.ip, clock());
    });
  }

  return {
    async passwordLogin(request: FastifyRequest, reply: FastifyReply) {
      origin(request);
      const body = request.body as { username?: string; email?: string; password: string };
      return establish(request, reply, await passwords().login(body?.username || body?.email || '', body?.password));
    },

    async passwordRegister(request: FastifyRequest, reply: FastifyReply) {
      origin(request);
      return establish(
        request,
        reply,
        await passwords().register((request.body || {}) as Parameters<ReturnType<typeof passwords>['register']>[0]),
      );
    },

    async forgotPassword(request: FastifyRequest) {
      await limit(request);
      await passwords().forgot((request.body as { identifier?: unknown })?.identifier);
      return { ok: true };
    },

    async changePassword(request: FastifyRequest) {
      passwords();
      await limit(request);
      const current = await requireCurrent(request);
      const [identity] = await db
        .select()
        .from(identities)
        .where(and(eq(identities.playerId, current.id), eq(identities.provider, `sso:${config.sso!.issuer}`)));
      if (!identity) throw new HttpError(401, 'UNAUTHENTICATED');
      const body = request.body as { currentPassword: string; newPassword: string };
      await passwords().change(
        { issuer: config.sso!.issuer, subject: identity.subject, name: current.name },
        body?.currentPassword,
        body?.newPassword,
      );
      return { ok: true };
    },

    async handoff(request: FastifyRequest, reply: FastifyReply) {
      reply.header('Cache-Control', 'no-store');
      passwords();
      origin(request);
      await requireCurrent(request);
      const token = request.cookies[SESSION_COOKIE]!;
      return shared.exclusive(`sso-refresh:${hashSessionToken(token)}`, async () => {
        const [session] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.tokenHash, hashSessionToken(token)));
        if (!session?.ssoRefresh) throw new HttpError(401, 'UNAUTHENTICATED');
        const result = await passwords()
          .outgoing(session.ssoRefresh, (request.body as { target: string })?.target)
          .catch((error: unknown) => {
            if (error instanceof HttpError) throw error;
            throw new HttpError(401, 'UNAUTHENTICATED');
          });
        await db.update(sessions).set({ ssoRefresh: result.refresh }).where(eq(sessions.tokenHash, session.tokenHash));
        return { url: result.url, token: result.token };
      });
    },

    async acceptHandoff(request: FastifyRequest, reply: FastifyReply) {
      reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
      try {
        // A signed token proves the account, not who submitted it: only our pages and configured partners may
        // post it, otherwise any site could sign a visitor into the attacker's account (login CSRF).
        const source = request.headers.origin;
        if (!source || ![new URL(config.webOrigin).origin, ...(config.sso?.handoffOrigins ?? [])].includes(source))
          throw new Error('Untrusted handoff origin');
        const token = (request.body as { token?: unknown })?.token;
        if (typeof token !== 'string' || token.length > 16000) throw new Error('Invalid handoff');
        const verified = await passwords().verify(token);
        await shared.exclusive(`sso-jti:${verified.jti}`, async () => {
          if (await shared.get(`sso-jti:${verified.jti}`)) throw new Error('Replay');
          await shared.set(`sso-jti:${verified.jti}`, true, 120_000);
        });
        const refresh = await passwords().accept(token);
        await establish(request, reply, { profile: verified.profile, refresh });
        return reply.redirect(`${config.webOrigin}/`);
      } catch {
        return reply.redirect(`${config.webOrigin}/?auth=handoff-failed`);
      }
    },
  };
}
