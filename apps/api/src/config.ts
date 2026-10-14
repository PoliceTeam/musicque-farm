export type ApiConfig = {
  databaseUrl: string;
  redisUrl?: string;
  host: string;
  port: number;
  webOrigin: string;
  publicApiUrl: string;
  secureCookies: boolean;
  /** Behind a reverse proxy: take the client address from X-Forwarded-For (sign-in limits are per address). */
  trustProxy: boolean;
  google?: { clientId: string; clientSecret: string };
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const port = Number(env.PORT ?? 3001);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
  const host = env.HOST ?? '127.0.0.1';
  return {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL || undefined,
    host,
    port,
    webOrigin: (env.WEB_ORIGIN ?? 'http://127.0.0.1:5173').replace(/\/$/, ''),
    publicApiUrl: (env.PUBLIC_API_URL ?? `http://${host}:${port}/api`).replace(/\/$/, ''),
    secureCookies: env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY === 'true',
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
  };
}
