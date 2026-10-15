export type Screen = { styles: string; mount(): () => void };

/** A late import may resolve after another route. Only the newest screen may mount. */
export function createScreenRouter(options: {
  load: (path: string) => Promise<Screen>;
  prepare: (styles: string, path: string) => void;
  onLeave?: () => void;
  onError: (error: unknown) => void;
}) {
  let revision = 0;
  let cleanup: (() => void) | undefined;
  return {
    async open(path: string) {
      const current = ++revision;
      cleanup?.();
      cleanup = undefined;
      options.onLeave?.();
      try {
        const screen = await options.load(path);
        if (current !== revision) return;
        options.prepare(screen.styles, path);
        cleanup = screen.mount();
      } catch (error) {
        if (current === revision) options.onError(error);
      }
    },

    destroy() {
      revision++;
      cleanup?.();
      cleanup = undefined;
    },
  };
}

export function gameRoute(path: string, production = process.env.NODE_ENV === 'production') {
  const normalized = path.replace(/\/$/, '') || '/';
  if (
    production &&
    ['/ui', '/ui.html', '/town', '/town.html', '/farm-art-review', '/farm-art-review.html'].includes(normalized)
  )
    return undefined;
  const routes: Record<string, string> = {
    '/': '/map',
    '/index.html': '/map',
    '/map': '/map',
    '/map.html': '/map',
    '/farm': '/farm',
    '/farm.html': '/farm',
    '/character': '/character',
    '/character.html': '/character',
    '/farm-art-review': '/farm-art-review',
    '/farm-art-review.html': '/farm-art-review',
    '/town': '/town',
    '/town.html': '/town',
    '/ui': '/ui',
    '/ui.html': '/ui',
  };
  return routes[normalized];
}
