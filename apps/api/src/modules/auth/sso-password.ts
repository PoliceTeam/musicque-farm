import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import * as oidc from 'openid-client';
import { HttpError } from '@/_utils/http-errors';
import type { ApiConfig } from '@/config';
import type { SsoProfile } from './sso-oidc';

export function tokenVault(key: string | undefined) {
  function bytes() {
    if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('SSO_TOKEN_KEY must contain 32 random bytes in hex');
    return Buffer.from(key, 'hex');
  }

  return {
    seal(value: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', bytes(), iv);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    },

    open(value: string) {
      const data = Buffer.from(value, 'base64url');
      const cipher = createDecipheriv('aes-256-gcm', bytes(), data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
}

export function ssoProfile(claims: Record<string, unknown>): SsoProfile {
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || typeof claims.iss !== 'string')
    throw new Error('Invalid subject');
  return {
    issuer: claims.iss,
    subject: claims.sub,
    name: String(claims.name || claims.given_name || claims.preferred_username || 'Chibi'),
    ...(typeof claims.preferred_username === 'string' ? { username: claims.preferred_username } : {}),
  };
}

export function createPasswordProvider(
  settings: NonNullable<ApiConfig['sso']>,
  transport: typeof fetch,
  webUrl: string,
) {
  let config: Promise<oidc.Configuration> | undefined;
  const jwks = createRemoteJWKSet(new URL(`${settings.issuer}/protocol/openid-connect/certs`), {
    [customFetch]: transport,
  });
  const vault = tokenVault(settings.tokenKey);

  function configuration() {
    config ??= oidc
      .discovery(new URL(settings.issuer), settings.clientId, settings.clientSecret, undefined, {
        [oidc.customFetch]: transport,
        execute: [
          oidc.enableNonRepudiationChecks,
          ...(settings.issuer.startsWith('http:') ? [oidc.allowInsecureRequests] : []),
        ],
      })
      .catch((error) => {
        config = undefined;
        throw error;
      });
    return config;
  }

  async function grant(type: string, parameters: Record<string, string>) {
    return oidc.genericGrantRequest(await configuration(), type, parameters);
  }

  async function admin(path: string, method = 'GET', body?: unknown) {
    const tokens = await grant('client_credentials', {});
    const response = await transport(`${settings.issuer.replace('/realms/', '/admin/realms/')}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Only inspect known error categories; never surface provider data in logs.
      const data = (await response.json().catch(() => ({}))) as { errorMessage?: string };
      throw new HttpError(
        response.status === 409 ? 409 : 400,
        response.status === 409
          ? /email/i.test(data.errorMessage || '')
            ? 'EMAIL_TAKEN'
            : 'USERNAME_TAKEN'
          : 'INVALID_INPUT',
      );
    }
    return response.status === 204 || response.status === 201 ? undefined : response.json();
  }

  async function login(username: string, password: string) {
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      username.length > 254 ||
      typeof password !== 'string' ||
      !password ||
      password.length > 200
    )
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    let tokens: Awaited<ReturnType<typeof grant>>;
    try {
      tokens = await grant('password', { username: username.trim(), password, scope: 'openid profile' });
    } catch {
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    }
    if (!tokens.id_token || !tokens.refresh_token) throw new HttpError(401, 'INVALID_CREDENTIALS');
    return { profile: ssoProfile(tokens.claims()!), refresh: vault.seal(tokens.refresh_token) };
  }

  async function exchange(token: string, audience: string, refresh = false) {
    return grant('urn:ietf:params:oauth:grant-type:token-exchange', {
      subject_token: token,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: `urn:ietf:params:oauth:token-type:${refresh ? 'refresh_token' : 'access_token'}`,
      audience,
      scope: 'openid profile',
    });
  }

  return {
    login,

    async register(body: { username: string; password: string; name?: string; email?: string }) {
      if (
        !/^[a-z0-9][a-z0-9._-]{2,23}$/.test(body.username) ||
        typeof body.password !== 'string' ||
        body.password.length < 8 ||
        body.password.length > 200 ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.length > 40 ||
        (body.email && (typeof body.email !== 'string' || body.email.length > 254))
      )
        throw new HttpError(400, 'INVALID_INPUT');
      await admin('/users', 'POST', {
        username: body.username,
        firstName: body.name.trim(),
        ...(body.email ? { email: body.email } : {}),
        enabled: true,
        credentials: [{ type: 'password', value: body.password, temporary: false }],
      });
      return login(body.username, body.password);
    },

    async forgot(identifier: unknown) {
      try {
        if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254) return;
        const query = new URLSearchParams({
          exact: 'true',
          [identifier.includes('@') ? 'email' : 'username']: identifier.trim(),
        });
        const users = (await admin(`/users?${query}`)) as { id: string; email?: string }[];
        if (users[0]?.email)
          await admin(
            `/users/${encodeURIComponent(users[0].id)}/execute-actions-email?${new URLSearchParams({ client_id: settings.clientId, redirect_uri: `${webUrl}/` })}`,
            'PUT',
            ['UPDATE_PASSWORD'],
          );
      } catch {
        console.warn('SSO: chưa gửi được thư đặt lại mật khẩu; kiểm tra SMTP/cấu hình.');
      }
    },

    async change(profile: SsoProfile, currentPassword: string, newPassword: string) {
      const user = (await admin(`/users/${encodeURIComponent(profile.subject)}`)) as { username: string };
      const verified = await login(user.username, currentPassword);
      if (verified.profile.subject !== profile.subject) throw new HttpError(401, 'INVALID_CREDENTIALS');
      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200)
        throw new HttpError(400, 'INVALID_INPUT');
      await admin(`/users/${encodeURIComponent(profile.subject)}/reset-password`, 'PUT', {
        type: 'password',
        value: newPassword,
        temporary: false,
      });
    },

    async outgoing(encrypted: string, target: string) {
      const url = settings.targets?.[target];
      if (typeof target !== 'string' || !Object.hasOwn(settings.targets || {}, target) || !url)
        throw new HttpError(400, 'INVALID_INPUT');
      const tokens = await oidc.refreshTokenGrant(await configuration(), vault.open(encrypted));
      const handoff = await exchange(tokens.access_token, target);
      return { url, token: handoff.access_token, refresh: vault.seal(tokens.refresh_token || vault.open(encrypted)) };
    },

    async verify(token: string) {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: settings.issuer,
        audience: settings.clientId,
        algorithms: ['RS256'],
        maxTokenAge: '60s',
        clockTolerance: 3,
        requiredClaims: ['sub', 'jti', 'iat', 'exp', 'azp'],
      });
      if (
        typeof payload.azp !== 'string' ||
        !Object.hasOwn(settings.targets || {}, payload.azp) ||
        !payload.exp ||
        !payload.iat ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > 65 ||
        typeof payload.jti !== 'string' ||
        !payload.jti ||
        payload.jti.length > 200
      )
        throw new Error('Invalid handoff');
      return { profile: ssoProfile(payload), jti: payload.jti };
    },

    async accept(token: string) {
      const tokens = await exchange(token, settings.clientId, true);
      if (!tokens.refresh_token) throw new Error('Missing refresh token');
      return vault.seal(tokens.refresh_token);
    },
  };
}
