import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('opt-in performance report', () => {
  it('does not collect on normal visits or enable itself during navigation', async () => {
    const location = { search: '', origin: 'http://localhost', href: 'http://localhost/' };
    vi.stubGlobal('window', { location });
    const log = await import('@/application/performance-log');
    expect(log.beginPerformanceLoad('/map')).toBeUndefined();
    location.search = '?perf=1';
    expect(log.performanceRecorder()).toBeUndefined();
  });

  it('keeps the opt-in during navigation and exports only same-origin static resource paths', async () => {
    const location = { search: '?perf=1', origin: 'http://localhost', href: 'http://localhost/map?perf=1' };
    vi.stubGlobal('window', { location, innerWidth: 800, innerHeight: 600, devicePixelRatio: 2 });
    vi.stubGlobal('performance', {
      now: () => 100,

      getEntriesByType: (type: string) =>
        type === 'resource'
          ? [
              { name: 'http://localhost/chibi-assets/map/test.webp?v=secret', startTime: 1, duration: 3 },
              { name: 'http://localhost/api/player?token=secret', duration: 8 },
              { name: 'https://third-party.example/_next/static/tracker.js', duration: 9 },
            ]
          : [],
    });
    const log = await import('@/application/performance-log');
    const run = log.beginPerformanceLoad('/map?token=secret');
    location.search = '';
    log.performanceMark('first-frame-submitted', run);
    expect(log.performanceLoggingEnabled()).toBe(true);
    const report = log.performanceReport();
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0].route).toBe('/map');
    expect(report.resources).toHaveLength(1);
    expect(report.resources[0].path).toBe('/chibi-assets/map/test.webp');
    expect(JSON.stringify(report)).not.toContain('secret');
  });
});
