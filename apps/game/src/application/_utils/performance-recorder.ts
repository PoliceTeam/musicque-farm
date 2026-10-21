export type PerfPhase =
  | 'auth'
  | 'screen-code'
  | 'world-data'
  | 'renderer-import'
  | 'renderer-init'
  | 'scene-assets'
  | 'first-frame-submitted'
  | 'movement-observed'
  | 'zone-selected'
  | 'failed'
  | 'cancelled';
export type PerfEntry = { id: number; phase: PerfPhase; atMs: number; durationMs?: number };
export type PerfRun = { id: number; route: string; startedAtMs: number; entries: PerfEntry[] };

/** Bounded local measurements; each async job retains its original run, even after navigation. */
export function createPerformanceRecorder(clock: () => number, limit = 30) {
  const runs: PerfRun[] = [];
  const listeners = new Set<() => void>();
  let serial = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  function begin(route: string) {
    const run: PerfRun = { id: ++serial, route: route.split(/[?#]/)[0], startedAtMs: clock(), entries: [] };
    runs.push(run);
    if (runs.length > limit) runs.shift();
    notify();
    return run;
  }

  function mark(run: PerfRun, phase: PerfPhase, durationMs?: number) {
    if (!runs.includes(run) || run.entries.length >= 60) return;
    run.entries.push({
      id: run.entries.length + 1,
      phase,
      atMs: Math.round((clock() - run.startedAtMs) * 10) / 10,
      ...(durationMs === undefined ? {} : { durationMs: Math.round(durationMs * 10) / 10 }),
    });
    notify();
  }

  function once(run: PerfRun, phase: PerfPhase) {
    if (!run.entries.some((entry) => entry.phase === phase)) mark(run, phase);
  }

  function span(run: PerfRun, phase: PerfPhase) {
    const start = clock();
    let done = false;
    return () => {
      if (!done) {
        done = true;
        mark(run, phase, clock() - start);
      }
    };
  }

  return {
    begin,
    mark,
    once,
    span,

    snapshot: () => structuredClone(runs),

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
