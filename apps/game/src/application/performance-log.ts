import { createPerformanceRecorder, type PerfPhase, type PerfRun } from '@/application/_utils/performance-recorder';

let recorder: ReturnType<typeof createPerformanceRecorder> | undefined;
let active: PerfRun | undefined;
let enabled: boolean | undefined;

/** Opt-in for this document only; persists over client-side navigation, never across a reload. */
export function performanceLoggingEnabled() {
  if (typeof window === 'undefined') return false;
  enabled ??= new URLSearchParams(window.location.search).get('perf') === '1';
  return enabled;
}

export function performanceRecorder() {
  if (!performanceLoggingEnabled()) return undefined;
  recorder ??= createPerformanceRecorder(() => performance.now());
  return recorder;
}

export function beginPerformanceLoad(route: string) {
  const log = performanceRecorder();
  if (!log) return undefined;
  if (
    !active ||
    active.route !== route ||
    active.entries.some((entry) => entry.phase === 'cancelled' || entry.phase === 'failed')
  )
    active = log.begin(route);
  return active;
}

export function currentPerformanceLoad() {
  return active;
}

export function performanceSpan(phase: PerfPhase, run = active) {
  const log = performanceRecorder();
  return run && log ? log.span(run, phase) : () => {};
}

export function performanceMark(phase: PerfPhase, run = active) {
  if (run) performanceRecorder()?.once(run, phase);
}

/** No query strings, API payloads, cookies, player names or account identifiers in the export. */
export function performanceReport() {
  return {
    schemaVersion: 1,
    buildId: process.env.NEXT_PUBLIC_BUILD_REVISION ?? 'local',
    generatedAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio },
    navigation: performance.getEntriesByType('navigation').map((entry) => {
      const nav = entry as PerformanceNavigationTiming;
      return {
        type: nav.type,
        responseEndMs: nav.responseEnd,
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        loadEndMs: nav.loadEventEnd,
        transferBytes: nav.transferSize,
      };
    }),
    runs: performanceRecorder()?.snapshot() ?? [],
    resources: performance
      .getEntriesByType('resource')
      .flatMap((entry) => {
        const resource = entry as PerformanceResourceTiming;
        const url = new URL(resource.name, window.location.href);
        if (url.origin !== window.location.origin || !/\/(?:_next\/static|chibi-assets|branding)\//.test(url.pathname))
          return [];
        return [
          {
            path: url.pathname,
            startMs: resource.startTime,
            durationMs: resource.duration,
            transferBytes: resource.transferSize,
            encodedBytes: resource.encodedBodySize,
            decodedBytes: resource.decodedBodySize,
          },
        ];
      })
      .slice(-300),
  };
}
