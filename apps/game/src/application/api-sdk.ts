import {
  createBrowserRepository,
  createGameSdk,
  createLocalDocument,
  createMemoryRepository,
  type GameSdk,
} from '@chibi-town/api-sdk';
import { createHttpSdk } from '@chibi-town/api-sdk/http-adapter';
import { createRealtimeClient } from '@chibi-town/api-sdk/realtime-client';
import type { GameRealtime } from '@chibi-town/contracts/realtime';
import type { FarmProgress } from '@chibi-town/gameplay';
import { createDevLocalSdk, devNumber } from '@/application/_utils/dev-local-sdk';
import { realtimeUrl } from '@/application/_utils/public-path';
import { AUTH_REQUIRED_EVENT } from '@/application/auth-client';

export function getDevelopmentTimeScale() {
  return process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_API_URL
    ? devNumber(process.env.NEXT_PUBLIC_DEV_TIME_SCALE, 600, 3600)
    : 1;
}

let realtime: GameRealtime | undefined;

/** Live events from the server; undefined with the local adapter, where nobody else is playing. */
export function getRealtime(): GameRealtime | undefined {
  if (!process.env.NEXT_PUBLIC_API_URL || typeof WebSocket === 'undefined') return undefined;
  // The API URL may be relative ("/api" behind the same domain); the socket needs an absolute ws(s) URL.
  realtime ??= createRealtimeClient({ url: realtimeUrl(process.env.NEXT_PUBLIC_API_URL, window.location.href) });
  return realtime;
}

let sdk: GameSdk | undefined;

export function getApiSdk(): GameSdk {
  if (sdk) return sdk;
  if (process.env.NEXT_PUBLIC_API_URL) {
    sdk = createHttpSdk({
      baseUrl: process.env.NEXT_PUBLIC_API_URL,

      onUnauthenticated: () => window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT)),
    });
  } else {
    const repository = createBrowserRepository({
      legacyOutfit() {
        try {
          return JSON.parse(localStorage.getItem('chibi-town.outfit.v2') ?? 'null');
        } catch {
          return null;
        }
      },

      legacy() {
        try {
          return JSON.parse(localStorage.getItem('chibi-town-farm-v1') ?? 'null');
        } catch {
          return null;
        }
      },
    });
    sdk =
      process.env.NODE_ENV === 'development'
        ? createDevLocalSdk(repository, {
            timeScale: getDevelopmentTimeScale(),
            coins: devNumber(process.env.NEXT_PUBLIC_DEV_COINS, 5_000_000, 1_000_000_000),
            gems: devNumber(process.env.NEXT_PUBLIC_DEV_GEMS, 1000, 1_000_000),
          })
        : createGameSdk({ adapter: 'local', repository });
  }
  return sdk;
}

export function createReviewSdk(progress: FarmProgress) {
  return createGameSdk({ adapter: 'local', repository: createMemoryRepository(createLocalDocument(progress)) });
}
