import { navigateArcadeRoute, parseArcadeRoute, readArcadeRoute } from '@chibi-town/arcade-games-react/arcade-route';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('restores game, room and table from a reloadable URL without issuing a game command', () => {
  expect(parseArcadeRoute('#game=tien-len&room=3&table=0')).toEqual({ game: 'tien-len', room: 3, table: 0 });
  expect(parseArcadeRoute('#game=chess&table=1').table).toBeUndefined();
  expect(parseArcadeRoute('#game=chess&room=-1&table=0').room).toBeUndefined();
  expect(parseArcadeRoute('#game=chess&room=1.2').room).toBeUndefined();
  expect(parseArcadeRoute('#game=bad%3Cscript')).toEqual({});
});

it('keeps the host router state but removes the previous table guard from internal navigation', () => {
  let url = new URL('http://localhost/play/fun/arcade-hall#game=tien-len&room=3&table=0');
  const state = { router: 'preserved', __arcadeTableBack: 'old-table' };
  const history = {
    state,
    pushState: vi.fn((next, _unused, href) => {
      history.state = next;
      url = new URL(href, url);
    }),
  };
  vi.stubGlobal('window', {
    get location() {
      return url;
    },

    history,
    dispatchEvent: vi.fn(),
  });
  expect(readArcadeRoute().table).toBe(0);
  navigateArcadeRoute({ game: 'tien-len', room: 3 });
  expect(url.hash).toBe('#game=tien-len&room=3');
  expect(history.state).toEqual({ router: 'preserved' });
  expect(readArcadeRoute().table).toBeUndefined();
});
