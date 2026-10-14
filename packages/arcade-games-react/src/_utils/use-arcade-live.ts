import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { useEffect, useRef } from 'react';
import { useArcadeHost } from '../host.js';

/**
 * Calls `refresh` whenever the server reports that a table or the lobby of this game changed. Events carry no
 * state, so the screen re-reads its own view through the SDK.
 */
export function useArcadeLive(gameId: ArcadeGameId, refresh: () => void) {
  const { realtime } = useArcadeHost();
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!realtime) return;
    realtime.send({ type: 'lobby.watch', gameId });
    const unsubscribe = realtime.subscribe((event) => {
      if ((event.type === 'match' || event.type === 'lobby') && event.gameId === gameId) latest.current();
    });
    return () => {
      unsubscribe();
      realtime.send({ type: 'lobby.unwatch' });
    };
  }, [realtime, gameId]);
}
