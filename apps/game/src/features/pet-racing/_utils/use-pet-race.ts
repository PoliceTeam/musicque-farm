import { ApiSdkError } from '@chibi-town/contracts';
import { type RaceBet, type RaceLobby, racePhase } from '@chibi-town/contracts/pet-racing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiSdk, getRealtime } from '@/application/api-sdk';
import { nextRaceRefreshDelay } from '@/features/pet-racing/_utils/race-logic';

export function usePetRace(onWallet?: (coins: number) => void) {
  const [lobby, setLobby] = useState<RaceLobby>();
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<RaceBet>();
  const current = useRef<RaceLobby | undefined>(undefined);
  const anchor = useRef({ server: 0, local: 0 });
  const alive = useRef(false);
  const sending = useRef(false);
  const refreshing = useRef<Promise<void> | undefined>(undefined);
  const pendingRef = useRef<RaceBet | undefined>(undefined);
  const wallet = useRef(onWallet);
  wallet.current = onWallet;

  const serverNow = useCallback(() => anchor.current.server + performance.now() - anchor.current.local, []);
  const apply = useCallback((data: RaceLobby) => {
    if (
      !alive.current ||
      (current.current && (data.revision < current.current.revision || data.serverTime < current.current.serverTime))
    )
      return;
    if (current.current?.round.id !== data.round.id) setError('');
    else setError((value) => (value === 'NETWORK_ERROR' ? '' : value));
    const changedWallet = current.current?.coins !== data.coins;
    anchor.current = { server: data.serverTime, local: performance.now() };
    current.current = data;
    setLobby(data);
    setNow(data.serverTime);
    if (changedWallet) wallet.current?.(data.coins);
    if (
      pendingRef.current &&
      (data.bet?.requestId === pendingRef.current.requestId || data.round.id !== pendingRef.current.roundId)
    ) {
      pendingRef.current = undefined;
      setPending(undefined);
      setError('');
    }
  }, []);

  const refresh = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const request = (async () => {
      try {
        apply(await getApiSdk().getPetRace());
      } catch {
        if (alive.current) setError('NETWORK_ERROR');
      }
    })();
    refreshing.current = request;
    void request.finally(() => {
      if (refreshing.current === request) refreshing.current = undefined;
    });
    return request;
  }, [apply]);

  useEffect(() => {
    alive.current = true;
    const realtime = getRealtime();
    const stop = realtime?.subscribe((event) => {
      if (document.hidden) return;
      if (
        event.type === 'reconnected' ||
        (event.type === 'pet-race.changed' &&
          (current.current?.round.id !== event.roundId || current.current?.round.phase !== event.phase))
      )
        void refresh();
    });
    realtime?.send({ type: 'pet-race.watch' });
    void refresh();
    // Low-frequency recovery for disposable pushes; no per-second HTTP polling.
    const recovery = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const clock = setInterval(() => {
      if (current.current) setNow(serverNow());
    }, 100);

    const focus = () => {
      if (!document.hidden) void refresh();
    };

    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      alive.current = false;
      stop?.();
      realtime?.send({ type: 'pet-race.unwatch' });
      clearInterval(recovery);
      clearInterval(clock);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [refresh, serverNow]);

  useEffect(() => {
    if (!lobby) return;
    const timer = setTimeout(
      () => {
        if (!document.hidden) void refresh();
      },
      nextRaceRefreshDelay(lobby.round, serverNow()),
    );
    return () => clearTimeout(timer);
  }, [lobby, refresh, serverNow]);

  const submit = useCallback(
    async (pet: number, stake: number) => {
      const data = current.current;
      if (
        sending.current ||
        !data ||
        (!pendingRef.current &&
          (racePhase(data.round, serverNow()) !== 'betting' || serverNow() >= data.round.nextRoundAt || data.bet))
      )
        return;
      const input = pendingRef.current ?? { requestId: crypto.randomUUID(), roundId: data.round.id, pet, stake };
      pendingRef.current = input;
      sending.current = true;
      setPending(input);
      setBusy(true);
      setError('');
      try {
        const result = await getApiSdk().betPetRace(input);
        if (!alive.current) return;
        pendingRef.current = undefined;
        setPending(undefined);
        apply(result);
        return true;
      } catch (err) {
        if (!alive.current) return;
        const code = err instanceof ApiSdkError ? err.code : 'NETWORK_ERROR';
        if (code !== 'NETWORK_ERROR') {
          pendingRef.current = undefined;
          setPending(undefined);
        }
        setError(code);
        await refresh();
      } finally {
        sending.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [apply, refresh, serverNow],
  );
  return { lobby, now, busy, error, pending, current, serverNow, refresh, submit };
}
