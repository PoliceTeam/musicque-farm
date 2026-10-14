import type { Outfit } from '@chibi-town/character-core/character-types';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
export const AUTH_REQUIRED_EVENT = 'chibi-auth-required';
export type AuthPlayer = {
  id: string;
  name: string;
  level: number;
  guest: boolean;
  username: string | null;
  characterSetupRequired?: boolean;
  characterSetupOutfit?: Outfit;
};
export type AuthState = { player: AuthPlayer | null; providers: { google: boolean } };
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_INPUT'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'USERNAME_IMMUTABLE'
  | 'RENAME_TOO_SOON'
  | 'TOO_MANY_ATTEMPTS'
  | 'NETWORK_ERROR';
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly nextAllowedAt?: number,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}
export type AuthClient = ReturnType<typeof createAuthClient>;

function readPlayer(value: unknown): AuthPlayer | null {
  const player = value as AuthPlayer | null;
  if (player === null) return null;
  if (
    !player ||
    typeof player.id !== 'string' ||
    typeof player.name !== 'string' ||
    !Number.isSafeInteger(player.level) ||
    typeof player.guest !== 'boolean' ||
    (player.username !== null && typeof player.username !== 'string')
  )
    throw new AuthError('NETWORK_ERROR');
  return {
    id: player.id,
    name: player.name,
    username: player.username,
    level: player.level,
    guest: player.guest,
    ...(player.characterSetupRequired === true
      ? { characterSetupRequired: true, characterSetupOutfit: sanitizeOutfit(player.characterSetupOutfit) }
      : {}),
  };
}

/** Account calls of `apps/api`; the session itself lives in an http-only cookie the page cannot read. */
export function createAuthClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request(path: string, body?: unknown) {
    let response: Response;
    let data: { code?: unknown; player?: unknown; providers?: { google?: unknown }; nextAllowedAt?: unknown };
    try {
      response = await (options.fetch ?? fetch)(`${baseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      data = await response.json();
    } catch {
      throw new AuthError('NETWORK_ERROR');
    }
    if (!response.ok)
      throw new AuthError(
        (
          [
            'INVALID_CREDENTIALS',
            'INVALID_INPUT',
            'EMAIL_TAKEN',
            'USERNAME_TAKEN',
            'USERNAME_IMMUTABLE',
            'RENAME_TOO_SOON',
            'TOO_MANY_ATTEMPTS',
          ] as const
        ).find((code) => code === data?.code) ?? 'NETWORK_ERROR',
        typeof data.nextAllowedAt === 'number' ? data.nextAllowedAt : undefined,
      );
    return data;
  }

  const signedIn = async (path: string, body: unknown) => {
    const player = readPlayer((await request(path, body)).player);
    if (!player) throw new AuthError('NETWORK_ERROR');
    return player;
  };

  let starting: Promise<AuthState> | undefined;
  const api = {
    googleUrl: `${baseUrl}/auth/google`,

    async session(): Promise<AuthState> {
      const data = await request('/auth/session');
      return { player: readPlayer(data.player ?? null), providers: { google: data.providers?.google === true } };
    },

    guest: () => signedIn('/auth/guest', {}),

    login: (input: { email: string; password: string }) => signedIn('/auth/login', input),

    setUsername: (username: string, outfit?: Outfit) => signedIn('/auth/username', { username, outfit }),

    completeCharacter: (outfit: Outfit) => signedIn('/auth/character', { outfit }),

    rename: (name: string) => signedIn('/player/name', { name }),

    register: (input: { email?: string; password: string; name: string; username: string; outfit?: Outfit }) =>
      signedIn('/auth/register', input),

    start(): Promise<AuthState> {
      starting ??= api
        .session()
        .then(async (state) => ({ ...state, player: state.player ?? (await api.guest()) }))
        .finally(() => {
          starting = undefined;
        });
      return starting;
    },

    async logout() {
      await request('/auth/logout', {});
    },
  };
  return api;
}

let client: AuthClient | undefined;

/** Undefined with the local adapter: a browser-only save has no account. */
export function getAuthClient() {
  if (!process.env.NEXT_PUBLIC_API_URL) return undefined;
  client ??= createAuthClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL });
  return client;
}
