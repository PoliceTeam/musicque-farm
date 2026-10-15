import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '@/_utils/http-errors';
import type { ExternalProfile } from '@/modules/auth/service';

export type GoogleClient = { clientId: string; clientSecret: string; redirectUri: string };

/** Authorization-code flow with PKCE; `state` and `verifier` stay in a short-lived cookie. */
export function startGoogleSignIn(client: GoogleClient) {
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), state, verifier };
}

export async function readGoogleProfile(
  client: GoogleClient,
  code: string,
  verifier: string,
  transport: typeof fetch,
): Promise<ExternalProfile> {
  const denied = () => new HttpError(401, 'INVALID_CREDENTIALS');

  const tokens = await transport('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
    }),
  });
  if (!tokens.ok) throw denied();
  const { access_token: accessToken } = (await tokens.json()) as { access_token?: unknown };
  if (typeof accessToken !== 'string' || !accessToken) throw denied();
  const response = await transport('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw denied();
  const user = (await response.json()) as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown };
  if (typeof user.sub !== 'string' || !user.sub || typeof user.email !== 'string') throw denied();
  return {
    provider: 'google',
    subject: user.sub,
    email: user.email,
    emailVerified: user.email_verified === true,
    name: typeof user.name === 'string' ? user.name : '',
  };
}
