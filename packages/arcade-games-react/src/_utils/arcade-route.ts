import { useMemo, useSyncExternalStore } from 'react';

export type ArcadeRoute = { game?: string; room?: number; table?: number };
const eventName = 'arcade-location-change';

export function parseArcadeRoute(hash: string): ArcadeRoute {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const game = params.get('game');
  if (!game || !/^[a-z][a-z0-9-]{0,63}$/.test(game)) return {};

  const number = (key: string) => {
    const value = params.get(key);
    return value !== null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
  };

  const room = number('room');
  return { game, room, table: room === undefined ? undefined : number('table') };
}

export function readArcadeRoute(): ArcadeRoute {
  return parseArcadeRoute(typeof window === 'undefined' ? '' : window.location.hash);
}

export function navigateArcadeRoute(route: ArcadeRoute, replace = false) {
  const params = new URLSearchParams();
  if (route.game) params.set('game', route.game);
  if (route.room !== undefined) params.set('room', String(route.room));
  if (route.table !== undefined) params.set('table', String(route.table));
  const hash = params.size ? `#${params}` : '';
  if (window.location.hash === hash) return;
  const state = { ...window.history.state };
  delete state.__arcadeTableBack;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history[replace ? 'replaceState' : 'pushState'](state, '', url);
  window.dispatchEvent(new Event(eventName));
}

function subscribe(listener: () => void) {
  // Back is intercepted on popstate while a wager-leave confirmation is pending.
  // A second hashchange subscription would bypass that guard.
  window.addEventListener('popstate', listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(eventName, listener);
  };
}

export function useArcadeRoute() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return useMemo(() => parseArcadeRoute(hash), [hash]);
}

/** URLs select a view only. Restoring a table never creates a match or sends a game command. */
export function useArcadeTableRoute(gameId: string) {
  const route = useArcadeRoute();
  return {
    roomId: route.game === gameId ? route.room : undefined,
    atTable: route.game === gameId && route.table !== undefined,

    setRoomId(room?: number) {
      navigateArcadeRoute({ game: gameId, room });
    },

    setAtTable(atTable: boolean, table = 0, room = readArcadeRoute().room) {
      navigateArcadeRoute({ game: gameId, room, table: atTable ? table : undefined });
    },
  };
}

export { roomNumber } from './room-number.js';
