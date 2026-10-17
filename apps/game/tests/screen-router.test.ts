import { describe, expect, it, vi } from 'vitest';
import { createScreenRouter, gameRoute, type Screen } from '@/application/screen-router';

describe('screen routing lifecycle', () => {
  it('canonicalizes legacy entries and preserves unsupported links for normal navigation', () => {
    expect(gameRoute('/')).toBe('/map');
    expect(gameRoute('/farm.html')).toBe('/farm');
    expect(gameRoute('/character/')).toBe('/character');
    expect(gameRoute('/ui.html')).toBe('/ui');
    expect(gameRoute('/play/fun/pet-racing', true)).toBe('/pet-racing');
    expect(gameRoute('/play/fun/pet-racing/')).toBe('/pet-racing');
    expect(gameRoute('/external')).toBeUndefined();
  });
  it('disposes each mounted screen once before opening another and leaves app services untouched', async () => {
    const lifecycle: string[] = [];
    const router = createScreenRouter({
      async load(path) {
        return {
          styles: '',

          mount: () => {
            lifecycle.push(`mount:${path}`);
            return () => {
              lifecycle.push(`destroy:${path}`);
            };
          },
        };
      },

      prepare: vi.fn(),
      onError: vi.fn(),
    });
    await router.open('/map');
    await router.open('/farm');
    await router.open('/character');
    router.destroy();
    router.destroy();
    expect(lifecycle).toEqual([
      'mount:/map',
      'destroy:/map',
      'mount:/farm',
      'destroy:/farm',
      'mount:/character',
      'destroy:/character',
    ]);
  });
  it('does not mount an old screen whose asynchronous import finishes late', async () => {
    let resolve!: (screen: Screen) => void;
    const staleMount = vi.fn();
    const currentMount = vi.fn(() => vi.fn());
    const router = createScreenRouter({
      load: (path) =>
        path === '/farm'
          ? new Promise((r) => {
              resolve = r;
            })
          : Promise.resolve({ styles: 'new', mount: currentMount }),

      prepare: vi.fn(),
      onError: vi.fn(),
    });
    const old = router.open('/farm');
    await router.open('/map');
    resolve({ styles: 'old', mount: staleMount });
    await old;
    expect(staleMount).not.toHaveBeenCalled();
    expect(currentMount).toHaveBeenCalledOnce();
    router.destroy();
  });
  it('ignores late errors and imports after disposal', async () => {
    let reject!: (error: Error) => void;
    const error = vi.fn();
    const router = createScreenRouter({
      load: () =>
        new Promise((_r, j) => {
          reject = j;
        }),

      prepare: vi.fn(),
      onError: error,
    });
    const opening = router.open('/farm');
    router.destroy();
    reject(new Error('late'));
    await opening;
    expect(error).not.toHaveBeenCalled();
  });
});

it('blocks all devtool routes and legacy aliases in production', () => {
  for (const path of ['/ui', '/ui.html', '/ui/', '/town', '/town.html', '/farm-art-review', '/farm-art-review.html']) {
    expect(gameRoute(path, true)).toBeUndefined();
    expect(gameRoute(path, false)).toBeDefined();
  }
  expect(gameRoute('/farm.html', true)).toBe('/farm');
});
