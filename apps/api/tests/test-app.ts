import { createHttpSdk } from '@chibi-town/api-sdk';
import { createApp } from '@/app';
import type { ApiConfig } from '@/config';
import { openDatabase } from '@/db/database';
import type { SharedState } from '@/modules/realtime/shared-state';

export const testConfig: ApiConfig = {
  databaseUrl: '',
  host: '127.0.0.1',
  port: 0,
  webOrigin: 'http://game.test',
  publicApiUrl: 'http://api.test/api',
  secureCookies: false,
  trustProxy: false,
};

/** Real migrations on an in-process Postgres, so the suite needs no running database. */
export async function createTestApp(
  options: {
    config?: Partial<ApiConfig>;
    fetch?: typeof fetch;
    shared?: SharedState;
    database?: Awaited<ReturnType<typeof openDatabase>>;
  } = {},
) {
  const database = options.database ?? (await openDatabase('pglite:memory'));
  const db = database.db;
  let now = 1_700_000_000_000;
  const { app, tables } = await createApp({
    db,
    shared: options.shared,
    config: { ...testConfig, ...options.config },

    clock: () => now,

    sweepMs: 0,
    goneAfterMs: 30,
    fetch: options.fetch,
  });

  const cookieOf = (headers: Record<string, unknown>) =>
    [headers['set-cookie'] ?? []]
      .flat()
      .map((value) => String(value).split(';')[0])
      .join('; ');

  let accountSequence = 0;

  async function register(name: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: `192.0.2.${++accountSequence}`,
      payload: {
        email: `${name}@example.test`,
        password: 'correct horse',
        name,
        username: name.replace(/[^a-z0-9_.]/g, '_').padEnd(3, '_'),
      },
    });
    if (response.statusCode !== 201) throw new Error(`register failed: ${response.body}`);
    return {
      cookie: cookieOf(response.headers),
      player: response.json().player as { id: string; name: string; username: string | null; guest: boolean },
    };
  }

  /** The real HTTP adapter, with its fetch routed into the app. */
  const sdkFor = (cookie: string) =>
    createHttpSdk({
      baseUrl: 'http://api.test/api',

      fetch: async (url, init) => {
        const response = await app.inject({
          method: (init?.method ?? 'GET') as 'GET' | 'POST',
          url: new URL(String(url)).pathname,
          headers: { cookie, ...(init?.body ? { 'content-type': 'application/json' } : {}) },
          payload: init?.body ? String(init.body) : undefined,
        });
        return new Response(response.body, { status: response.statusCode });
      },
    });

  return {
    app,
    tables,
    db,
    register,
    sdkFor,
    cookieOf,

    clock: () => now,

    advance: (ms: number) => {
      now += ms;
    },

    close: async () => {
      await app.close();
      await database.close();
    },
  };
}
