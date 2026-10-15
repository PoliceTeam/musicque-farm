import { createMemorySharedState, type SharedState } from '@/infrastructure/realtime/shared-state';

/**
 * Counts failed attempts per key in a sliding window using the configured shared store (memory or Redis).
 * Callers must hold an attempt lock around checking and recording an authentication attempt.
 */
export function createAttemptLimiter(
  limit: number,
  windowMs: number,
  shared: SharedState = createMemorySharedState(),
  namespace = 'attempts',
) {
  const keyOf = (key: string) => `${namespace}:${encodeURIComponent(key)}`;

  const recent = async (key: string, now: number) =>
    ((await shared.get<number[]>(keyOf(key))) ?? []).filter((at) => now - at < windowMs);

  return {
    blocked: async (key: string, now: number) => (await recent(key, now)).length >= limit,

    async fail(key: string, now: number) {
      await shared.exclusive(keyOf(key), async () => {
        await shared.set(keyOf(key), [...(await recent(key, now)), now], windowMs);
      });
    },

    async clear(key: string) {
      await shared.exclusive(keyOf(key), () => shared.delete(keyOf(key)));
    },
  };
}
