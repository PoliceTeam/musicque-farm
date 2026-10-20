import * as oidc from 'openid-client';
import type { ApiConfig } from '@/config';
import { tokenVault } from './sso-password';

export type SsoProfile = { issuer: string; subject: string; name: string; username?: string; refresh?: string };
export type SsoAttempt = {
  verifier: string;
  nonce: string;
  sessionHash: string | null;
  playerId?: string;
  popup: boolean;
};

/** Keep protocol validation in the OIDC client, including signature, issuer, audience and nonce. */
export function createSsoClient(settings: NonNullable<ApiConfig['sso']>, redirectUri: string, transport: typeof fetch) {
  let pending: Promise<oidc.Configuration> | undefined;

  function configuration() {
    pending ??= oidc
      .discovery(new URL(settings.issuer), settings.clientId, settings.clientSecret, undefined, {
        [oidc.customFetch]: transport,
        execute: [
          oidc.enableNonRepudiationChecks,
          ...(settings.issuer.startsWith('http:') ? [oidc.allowInsecureRequests] : []),
        ],
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    return pending;
  }

  return {
    /** `register` opens Keycloak's registration page instead of the sign-in form. */
    async start({ register = false } = {}) {
      const config = await configuration();
      const state = oidc.randomState();
      const verifier = oidc.randomPKCECodeVerifier();
      const nonce = oidc.randomNonce();
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid profile',
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        ...(register ? { prompt: 'create' } : {}),
      });
      return { state, verifier, nonce, url: url.href };
    },

    async finish(url: URL, state: string, attempt: SsoAttempt): Promise<SsoProfile> {
      const tokens = await oidc.authorizationCodeGrant(await configuration(), url, {
        pkceCodeVerifier: attempt.verifier,
        expectedState: state,
        expectedNonce: attempt.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims()!;
      if (!claims.sub || claims.sub.length > 255) throw new Error('Invalid SSO subject');
      return {
        issuer: claims.iss,
        ...(tokens.refresh_token && settings.tokenKey
          ? { refresh: tokenVault(settings.tokenKey).seal(tokens.refresh_token) }
          : {}),
        subject: claims.sub,
        name:
          typeof claims.name === 'string'
            ? claims.name
            : typeof claims.preferred_username === 'string'
              ? claims.preferred_username
              : 'Chibi',
        ...(typeof claims.preferred_username === 'string' ? { username: claims.preferred_username } : {}),
      };
    },

    async logoutUrl(postLogoutRedirectUri: string) {
      return oidc.buildEndSessionUrl(await configuration(), { post_logout_redirect_uri: postLogoutRedirectUri }).href;
    },
  };
}
