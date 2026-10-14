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

export function gameRoute(path: string) {
  const routes: Record<string, string> = {
    '/': '/map',
    '/index.html': '/map',
    '/map': '/map',
    '/map.html': '/map',
    '/farm': '/farm',
    '/farm.html': '/farm',
    '/character': '/character',
    '/character.html': '/character',
    '/town': '/town',
    '/ui': '/ui',
    '/ui.html': '/ui',
  };
  return routes[path.replace(/\/$/, '') || '/'];
}
