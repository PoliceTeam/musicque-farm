import { describe, expect, it } from 'vitest';
import { createPerformanceRecorder } from '@/application/_utils/performance-recorder';

describe('local performance recorder', () => {
  it('keeps overlapping work associated with its original route and completes spans once', () => {
    let now = 100;
    const log = createPerformanceRecorder(() => now);
    const first = log.begin('/map?token=private#account');
    const finish = log.span(first, 'renderer-import');
    now = 120;
    const second = log.begin('/play/fun');
    now = 180;
    finish();
    finish();
    log.once(second, 'first-frame-submitted');
    log.once(second, 'first-frame-submitted');
    expect(log.snapshot()).toMatchObject([
      { route: '/map', entries: [{ phase: 'renderer-import', atMs: 80, durationMs: 80 }] },
      { route: '/play/fun', entries: [{ phase: 'first-frame-submitted', atMs: 60 }] },
    ]);
    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(1);
  });

  it('bounds history and ignores callbacks belonging to evicted runs', () => {
    const log = createPerformanceRecorder(() => 0, 2);
    const old = log.begin('/old');
    const finish = log.span(old, 'auth');
    log.begin('/map');
    const current = log.begin('/farm');
    finish();
    for (let i = 0; i < 100; i++) log.mark(current, 'scene-assets');
    const snapshot = log.snapshot();
    expect(snapshot.map((run) => run.route)).toEqual(['/map', '/farm']);
    expect(snapshot[1].entries).toHaveLength(60);
    snapshot[1].entries.length = 0;
    expect(log.snapshot()[1].entries).toHaveLength(60);
  });

  it('notifies subscribers only until they unsubscribe', () => {
    const log = createPerformanceRecorder(() => 0);
    let changes = 0;
    const unsubscribe = log.subscribe(() => changes++);
    const run = log.begin('/map');
    log.once(run, 'zone-selected');
    log.once(run, 'zone-selected');
    unsubscribe();
    log.mark(run, 'auth');
    expect(changes).toBe(2);
  });
});
