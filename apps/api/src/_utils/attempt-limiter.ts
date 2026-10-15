import { createMemorySharedState, type SharedState } from '@/infrastructure/realtime/shared-state';

/**
 * Counts failed attempts per key in a sliding window, in memory. Enough to stop password guessing against one
 * process; several processes would each allow the limit.
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
