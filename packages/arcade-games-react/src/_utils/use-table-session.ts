import { useRef } from 'react';

/** Request/replay lifecycle shared by all four table screens. Resolve cancelled waits so callers can unwind. */
export function createTableSession() {
  const alive = { current: false },
    locked = { current: false },
    stale = { current: false },
    loading = { current: false },
    replayId = { current: 0 };
  const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  return {
    alive,
    locked,
    stale,
    loading,
    replayId,

    activate() {
      alive.current = true;
    },

    dispose() {
      alive.current = false;
      for (const [timer, resolve] of timers) {
        clearTimeout(timer);
        resolve();
      }
      timers.clear();
    },

    pause(ms: number) {
      if (!alive.current) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, ms);
        timers.set(timer, resolve);
      });
    },

    consumeStale() {
      if (!alive.current || locked.current || !stale.current) return false;
      stale.current = false;
      return true;
    },
  };
}

export function useTableSession() {
  const session = useRef<ReturnType<typeof createTableSession> | undefined>(undefined);
  if (!session.current) session.current = createTableSession();
  return session.current;
}
