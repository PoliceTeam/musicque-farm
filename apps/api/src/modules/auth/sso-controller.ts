import { randomBytes } from 'node:crypto';
import type { Coordination } from '@chibi-town/realtime-core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createAttemptLimiter } from '@/_utils/attempt-limiter';
import { HttpError } from '@/_utils/http-errors';
import { hashSessionToken, type PlayerAccount, readSession, SESSION_COOKIE } from '@/_utils/session-auth';
import type { ApiConfig } from '@/config';
import type { Database } from '@/infrastructure/database/database';
import { signInWithSso } from '@/modules/auth/service';
import { createSsoClient, type SsoAttempt } from '@/modules/auth/sso-oidc';

const COOKIE = 'farm_sso_attempt';
const TTL = 10 * 60_000;

export function createSsoController(deps: {
  db: Database;
  config: ApiConfig;
  clock: () => number;
  fetch: typeof fetch;
  shared: Coordination;
  signIn: (reply: FastifyReply, player: PlayerAccount, ssoRefresh?: string) => Promise<unknown>;
  revokeCookie: (request: FastifyRequest) => Promise<void>;
}) {
  const { config, db, clock, shared } = deps;
  const callbackUri = `${config.publicApiUrl}/auth/sso/callback`;
  const client = config.sso && createSsoClient(config.sso, callbackUri, deps.fetch);
  const cookie = {
    path: new URL(callbackUri).pathname.replace(/\/callback$/, ''),
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
  } as const;

  const limiter = createAttemptLimiter(20, 60_000, shared, 'sso-start');

  /** Without a known attempt the page decides at runtime: report to an opener, otherwise return to the game. */
  function complete(reply: FastifyReply, ok: boolean, popup?: boolean) {
    reply.header('Cache-Control', 'no-store');
    reply.header('Referrer-Policy', 'no-referrer');
    const target = `${config.webOrigin}/?auth=${ok ? 'sso' : 'sso-failed'}`;
    if (popup === false) return reply.redirect(target);
    const nonce = randomBytes(16).toString('base64url');

    const script = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

    reply.header(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`,
    );
    return reply
      .type('text/html; charset=utf-8')
      .send(
        `<!doctype html><meta charset="utf-8"><title>SSO</title><p>Đã xử lý đăng nhập. Bạn có thể đóng cửa sổ này.</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${script({ type: 'musicque:sso', ok })},${script(new URL(config.webOrigin).origin)});window.close();}else location.replace(${script(target)});</script>`,
      );
  }

  return {
    async ssoSignIn(request: FastifyRequest, reply: FastifyReply) {
      if (!client) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
      await shared.exclusive(`sso-start-lock:${request.ip}`, async () => {
        if (await limiter.blocked(request.ip, clock())) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
        await limiter.fail(request.ip, clock());
      });
      const query = request.query as { popup?: string; register?: string };
      const token = request.cookies[SESSION_COOKIE];
      const current = await readSession(db, token, clock());
      const flow = await client.start({ register: query.register === '1' });
      const attempt: SsoAttempt = {
        verifier: flow.verifier,
        nonce: flow.nonce,
        sessionHash: token ? hashSessionToken(token) : null,
        playerId: current?.id,
        popup: query.popup === '1',
      };
      await shared.set(`sso-attempt:${flow.state}`, attempt, TTL);
      reply.setCookie(COOKIE, flow.state, { ...cookie, maxAge: TTL / 1000 });
      reply.header('Cache-Control', 'no-store');
      return reply.redirect(flow.url);
    },

    async ssoCallback(request: FastifyRequest, reply: FastifyReply) {
      if (!client) throw new HttpError(404, 'PROVIDER_UNAVAILABLE');
      const state = request.cookies[COOKIE];
      reply.clearCookie(COOKIE, cookie);
      if (!state || state.length > 200 || (request.query as { state?: string }).state !== state)
        return complete(reply, false);
      const attempt = await shared.exclusive(`sso-attempt:${state}`, async () => {
        const value = await shared.get<SsoAttempt>(`sso-attempt:${state}`);
        await shared.delete(`sso-attempt:${state}`);
        return value;
      });
      if (!attempt) return complete(reply, false);
      try {
        const token = request.cookies[SESSION_COOKIE];
        if ((token ? hashSessionToken(token) : null) !== attempt.sessionHash) throw new Error('SSO session changed');
        const current = await readSession(db, token, clock());
        if (current?.id !== attempt.playerId) throw new Error('SSO account changed');
        // nginx strips /farm; authorizationCodeGrant must send the original public redirect_uri.
        const callbackUrl = new URL(callbackUri);
        callbackUrl.search = new URL(request.url, config.publicApiUrl).search;
        const profile = await client.finish(callbackUrl, state, attempt);
        const player = await signInWithSso(db, profile, current, clock());
        await deps.revokeCookie(request);
        await deps.signIn(reply, player, profile.refresh);
        return complete(reply, true, attempt.popup);
      } catch {
        // Never log authorization codes, tokens, user profiles or provider response bodies.
        request.log.warn({ event: 'sso_failed' }, 'SSO authentication failed');
        return complete(reply, false, attempt.popup);
      }
    },

    /** Keycloak ends its own session, then returns to the game; the app session is revoked before this. */
    ssoLogoutUrl: client ? () => client.logoutUrl(`${config.webOrigin}/`) : undefined,

    ssoAccountUrl: config.sso ? `${config.sso.issuer}/account` : undefined,
  };
}
