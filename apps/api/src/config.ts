export type PetRaceResetConfig = { enabled: boolean; time: string; timeZone: string };
export const DEFAULT_PET_RACE_RESET: PetRaceResetConfig = {
  enabled: true,
  time: '00:00',
  timeZone: 'Asia/Ho_Chi_Minh',
};

export type ApiConfig = {
  databaseUrl: string;
  backgroundJobs?: 'embedded' | 'worker';
  workerConcurrency?: number;
  petRaceReset?: PetRaceResetConfig;
  redisUrl?: string;
  redisCluster?: boolean;
  host: string;
  port: number;
  webOrigin: string;
  publicApiUrl: string;
  secureCookies: boolean;
  /** Behind a reverse proxy: take the client address from X-Forwarded-For (sign-in limits are per address). */
  trustProxy: boolean;
  sso?: {
    issuer: string;
    /** Private Keycloak root URL, including /sso; issuer remains public. */
    adminUrl?: string;
    clientId: string;
    clientSecret: string;
    tokenKey?: string;
    targets?: Record<string, string>;
    /** Partner web origins whose pages may post a handoff to us (our own origin is always allowed). */
    handoffOrigins?: string[];
  };
  google?: { clientId: string; clientSecret: string };
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const port = Number(env.PORT ?? 3001);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
  const host = env.HOST ?? '127.0.0.1';
  const backgroundJobs = env.BACKGROUND_JOBS_MODE ?? 'embedded';
  if (backgroundJobs !== 'embedded' && backgroundJobs !== 'worker') throw new Error('BACKGROUND_JOBS_MODE is invalid');
  if (backgroundJobs === 'worker' && (!/^postgres(?:ql)?:/.test(env.DATABASE_URL) || !env.REDIS_URL))
    throw new Error('Worker mode requires PostgreSQL and REDIS_URL');
  const workerConcurrency = Number(env.WORKER_CONCURRENCY ?? 2);
  if (!Number.isSafeInteger(workerConcurrency) || workerConcurrency < 1 || workerConcurrency > 32)
    throw new Error('WORKER_CONCURRENCY must be an integer from 1 to 32');

  const resetEnabled = env.PET_RACE_RESET_ENABLED ?? 'true';
  if (resetEnabled !== 'true' && resetEnabled !== 'false')
    throw new Error('PET_RACE_RESET_ENABLED must be true or false');
  const resetTime = env.PET_RACE_RESET_TIME ?? DEFAULT_PET_RACE_RESET.time;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(resetTime)) throw new Error('PET_RACE_RESET_TIME must use HH:mm');
  const resetTimeZone = env.PET_RACE_RESET_TIMEZONE ?? DEFAULT_PET_RACE_RESET.timeZone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: resetTimeZone }).format(0);
  } catch {
    throw new Error('PET_RACE_RESET_TIMEZONE is invalid');
  }

  const ssoValues = [env.SSO_ISSUER, env.SSO_CLIENT_ID, env.SSO_CLIENT_SECRET];
  if (ssoValues.some(Boolean) && !ssoValues.every(Boolean))
    throw new Error('SSO requires issuer, client id and secret');
  if (env.SSO_ISSUER) {
    const issuer = new URL(env.SSO_ISSUER);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname);
    if (
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      (issuer.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && loopback && issuer.protocol === 'http:'))
    )
      throw new Error('SSO_ISSUER requires HTTPS (HTTP loopback allowed only in development)');
  }
  return {
    databaseUrl: env.DATABASE_URL,
    backgroundJobs,
    workerConcurrency,
    petRaceReset: { enabled: resetEnabled === 'true', time: resetTime, timeZone: resetTimeZone },
    redisUrl: env.REDIS_URL || undefined,
    redisCluster: env.REDIS_CLUSTER === 'true',
    host,
    port,
    webOrigin: (env.WEB_ORIGIN ?? 'http://127.0.0.1:5173').replace(/\/$/, ''),
    publicApiUrl: (env.PUBLIC_API_URL ?? `http://${host}:${port}/api`).replace(/\/$/, ''),
    secureCookies: env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY === 'true',
    sso: env.SSO_ISSUER
      ? {
          issuer: env.SSO_ISSUER.replace(/\/$/, ''),
          adminUrl: env.SSO_ADMIN_URL?.replace(/\/$/, ''),
          clientId: env.SSO_CLIENT_ID!,
          clientSecret: env.SSO_CLIENT_SECRET!,
          tokenKey: env.SSO_TOKEN_KEY,
          handoffOrigins: (env.SSO_HANDOFF_ORIGINS || '')
            .split(',')
            .filter(Boolean)
            .map((value) => new URL(value.trim()).origin),
          targets: Object.fromEntries(
            (env.SSO_HANDOFF_TARGETS || '')
              .split(',')
              .filter(Boolean)
              .map((entry) => {
                const at = entry.indexOf('=');
                const id = entry.slice(0, at);
                const url = new URL(entry.slice(at + 1));
                if (
                  at < 1 ||
                  url.username ||
                  url.password ||
                  url.search ||
                  url.hash ||
                  (url.protocol !== 'https:' &&
                    !(
                      env.NODE_ENV !== 'production' &&
                      ['localhost', '127.0.0.1'].includes(url.hostname) &&
                      url.protocol === 'http:'
                    ))
                )
                  throw new Error('Invalid SSO handoff target');
                return [id, url.href];
              }),
          ),
        }
      : undefined,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
  };
}
