import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { TienAction, TienResult, TienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import { beatsTien, legalTienPlays, tienCombo } from '@chibi-town/arcade-games/tien-len-logic';
import type { ArcadeTableStart } from '@chibi-town/contracts/arcade-table';
import type { TienCommand, TienLobby } from '@chibi-town/contracts/tien-len';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArcadeGameProps } from '../_utils/arcade-game-props.js';
import { readArcadeRoute, useArcadeTableRoute } from '../_utils/arcade-route.js';
import { clearTable } from '../_utils/clear-table.js';
import { unseenTableSteps } from '../_utils/table-updates.js';
import { useArcadeLive } from '../_utils/use-arcade-live.js';
import { useTableSession } from '../_utils/use-table-session.js';
import { useArcadeHost } from '../host.js';
import { ArcadeActionProvider, ArcadeActions, ArcadeActionTarget, ArcadeFooterTimer } from './arcade-actions.js';
import { ArcadeDirectory } from './arcade-directory.js';
import { CoinChange } from './coin-change.js';
import { GameResultEffect } from './game-result-effect.js';
import { useLeaveTable } from './leave-table-dialog.js';
import { TableSettings } from './table-settings.js';
import { TienTable } from './tien-table.js';

export function TienGame({ player, back, coins, refreshWallet, audio }: ArcadeGameProps) {
  const { t } = useTranslation('common');
  const { sdk } = useArcadeHost();
  const [lobby, setLobby] = useState<TienLobby>();
  const [match, setMatch] = useState<TienSnapshot>();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [help, setHelp] = useState(false);
  const [event, setEvent] = useState<TienResult['steps'][number]>();
  const confirmed = useRef<TienSnapshot | undefined>(undefined);
  const command = useRef<TienCommand | undefined>(undefined);
  const roomRequest = useRef<ArcadeTableStart | undefined>(undefined);

  const { roomId, atTable, setRoomId, setAtTable } = useArcadeTableRoute('tien-len');
  const session = useTableSession();
  const { alive, locked, stale, loading } = session;

  async function replaySteps(steps: TienResult['steps']) {
    for (const step of steps) {
      if (!alive.current) return;
      setEvent(step);
      setMatch(step.match);
      setSelected([]);
      await pause();
    }
    setEvent(undefined);
  }

  async function load() {
    if (loading.current) {
      stale.current = true;
      return;
    }
    loading.current = true;
    try {
      const l = await sdk.getTienLobby();
      if (alive.current) {
        setLobby(l);
        // Someone else closed the table we were sitting at (they left, or a turn ran out).
        const closed = !!confirmed.current?.players && !l.activeMatch;
        const previous = confirmed.current;
        const next = l.activeMatch;
        const steps = unseenTableSteps(previous, next);
        if (previous && steps.length && !locked.current) {
          locked.current = true;
          setBusy(true);
          try {
            await replaySteps(steps);
          } finally {
            locked.current = false;
            if (alive.current) setBusy(false);
          }
          if (!alive.current) return;
        }
        confirmed.current = l.activeMatch;
        setMatch(l.activeMatch);
        const route = readArcadeRoute();
        if (
          route.table !== undefined &&
          (!l.activeMatch || l.activeMatch.roomId !== route.room || (l.activeMatch.tableId ?? 0) !== route.table)
        )
          setAtTable(false);
        setError(closed ? t('arcadeTableClosed') : '');
        if (closed) {
          setAtTable(false);
          setSelected([]);
          void refreshWallet();
        }
      }
    } catch {
      if (alive.current) setError(t('arcadeLoadFailed'));
    } finally {
      loading.current = false;
      if (session.consumeStale()) {
        void load();
      }
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: Load once; retry uses the current load handler explicitly.
  useEffect(() => {
    session.activate();
    void load();
    return () => {
      session.dispose();
    };
  }, []);
  /** Another player acted. A reload during our own request waits, so it cannot overwrite the replay in progress. */
  useArcadeLive('tien-len', () => {
    if (locked.current) stale.current = true;
    else void load().then(refreshWallet);
  });

  const pause = (ms = 650) => session.pause(ms);

  async function join(roomId: number, tableId: number) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    if (roomRequest.current?.roomId !== roomId || roomRequest.current?.tableId !== tableId)
      roomRequest.current = { roomId, tableId, requestId: crypto.randomUUID(), prepare: true };
    try {
      const next = await sdk.startTienRoom(roomRequest.current);
      if (!alive.current) return;
      confirmed.current = next;
      setMatch(next);
      setAtTable(true, next.tableId ?? 0, next.roomId);
      setSelected([]);
      roomRequest.current = undefined;
      setRetry(false);
    } catch {
      if (alive.current) setError(t('arcadeStartFailed'));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (session.consumeStale()) {
        void load();
      }
    }
  }

  async function send(action: TienAction, isRetry = false) {
    const source = confirmed.current;
    if (!source || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setRetry(false);
    const input =
      isRetry && command.current
        ? command.current
        : { requestId: crypto.randomUUID(), matchId: source.id, revision: source.revision, action };
    command.current = input;
    try {
      const result = await sdk.playTien(input);
      await replaySteps(result.steps);
      if (!alive.current) return;
      confirmed.current = result.match;
      setMatch(result.match);
      setEvent(undefined);
      command.current = undefined;
      await refreshWallet();
      void sdk
        .getTienLobby()
        .then((l) => {
          if (alive.current) setLobby(l);
        })
        .catch(() => {});
    } catch (failure) {
      if (!alive.current) return;
      setMatch(source);
      setEvent(undefined);
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'INSUFFICIENT_COINS') {
        setError(t('arcadeNoCoins'));
        command.current = undefined;
      } else if (['INVALID_PLAY', 'INVALID_TURN', 'CANNOT_PASS', 'MATCH_FINISHED'].includes(code)) {
        setError(t('tienInvalidPlay'));
        command.current = undefined;
      } else if (code === 'REQUEST_CONFLICT') {
        setError(t('tienStale'));
        command.current = undefined;
        void load();
      } else {
        setError(t('tienRequestFailed'));
        setRetry(true);
      }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (session.consumeStale()) {
        void load();
      }
    }
  }

  const leaving = useLeaveTable({
    onLeft: () => void load(),

    disabled: busy,
    gameId: 'tien-len',
    match: atTable ? confirmed.current : undefined,
    refreshWallet,
  });

  async function configured() {
    await load();
    await refreshWallet();
  }

  const combo = tienCombo(selected),
    canPlay =
      !!match &&
      !!combo &&
      beatsTien(combo, match.pile) &&
      (!match.opening || selected.includes(match.openingCard ?? 0));
  const active = lobby?.activeMatch && lobby.activeMatch.status !== 'finished' ? lobby.activeMatch : undefined;
  const legacyLeaving = useLeaveTable({
    gameId: 'tien-len',
    match: !atTable && active && !active.session ? active : undefined,
    refreshWallet,
    interceptNavigation: false,
  });
  return (
    <ArcadeActionProvider>
      <CoinChange coins={coins} audio={audio} />
      <GameResultEffect match={atTable ? match : undefined} />
      <section className="arcade-main arcade-main--tien">
        {!atTable && (
          <>
            {!lobby && <p role="status">{error || t('arcadeLoading')}</p>}
            {!lobby && error && <Button onClick={() => void load()}>{t('retry')}</Button>}
            {lobby && (
              <ArcadeDirectory
                gameId={'tien-len'}
                gameName={t('arcadeGameNames.tien-len')}
                rooms={lobby.rooms}
                roomId={roomId}
                active={active}
                busy={busy || legacyLeaving.busy}
                leaveLegacy={() =>
                  legacyLeaving.request(() => {
                    setRoomId(active!.roomId);
                    setLobby((l) => (l ? { ...l, activeMatch: undefined, rooms: clearTable(l.rooms, active) } : l));
                    confirmed.current = undefined;
                    setMatch(undefined);
                    setAtTable(false);
                    setSelected([]);
                    void load();
                  })
                }
                selectRoom={setRoomId}
                join={(room, table) => void join(room, table)}
              />
            )}
          </>
        )}
        {atTable && match && (
          <TableSettings
            key={match.id}
            gameId="tien-len"
            match={match}
            playerId={player.id}
            name={tablePlayerName(player)!}
            coins={lobby?.availableCoins ?? coins}
            changed={configured}
            locked={busy || retry}
            players={match.players}
            onStart={() => send({ type: 'start' })}
          />
        )}
        {atTable && match && (
          <TienTable
            match={match}
            outfit={player.outfit}
            name={tablePlayerName(player)!}
            selected={selected}
            busy={busy}
            event={event}
            actions={
              match.status === 'playing' && (
                <ArcadeActions>
                  {match.session?.mode === 'practice' && (
                    <Button
                      disabled={busy || retry || match.turn !== 0}
                      onClick={() => {
                        const hint = legalTienPlays(match.hand, match.pile, match.opening, match.openingCard ?? 0)[0];
                        setSelected(hint?.cards ?? []);
                        if (!hint) setError(t('tienNoMove'));
                      }}
                    >
                      {t('arcadeHint')}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    disabled={busy || retry || !canPlay || match.turn !== 0}
                    onClick={() => void send({ type: 'play', cards: selected })}
                  >
                    {t('tienPlay')}
                  </Button>
                  <Button
                    disabled={busy || retry || !match.pile || match.turn !== 0}
                    onClick={() => void send({ type: 'pass' })}
                  >
                    {t('tienPass')}
                  </Button>
                </ArcadeActions>
              )
            }
            toggle={(card) => {
              if (!retry)
                setSelected((current) =>
                  current.includes(card) ? current.filter((c) => c !== card) : [...current, card].sort((a, b) => a - b),
                );
            }}
          />
        )}
        {error && (
          <p className="tien-error" role="alert">
            {error}
          </p>
        )}
        <ArcadeActions>
          {atTable && match?.status === 'waiting' && !match.session && (
            <Button variant="primary" disabled={busy || retry} onClick={() => void send({ type: 'start' })}>
              {t('tienStart')}
            </Button>
          )}
          {atTable && match?.status === 'finished' && (
            <Button variant="primary" disabled={busy} onClick={() => void join(match.roomId, match.tableId ?? 0)}>
              {t('arcadePlayAgain')}
            </Button>
          )}
          {retry && (
            <Button
              disabled={busy}
              onClick={() => {
                if (command.current) void send(command.current.action, true);
              }}
            >
              {t('retry')}
            </Button>
          )}
        </ArcadeActions>
      </section>
      <footer className="arcade-footer">
        <Button
          disabled={busy || leaving.busy || legacyLeaving.busy}
          onClick={() => {
            if (atTable) {
              leaving.request(() => {
                setLobby((l) =>
                  l ? { ...l, activeMatch: undefined, rooms: clearTable(l.rooms, confirmed.current) } : l,
                );
                confirmed.current = undefined;
                setMatch(undefined);
                setAtTable(false);
                setSelected([]);
                void load();
              });
            } else if (roomId !== undefined) setRoomId(undefined);
            else back();
          }}
          aria-label={t('arcadeBack')}
        >
          <span aria-hidden="true">❮</span>
          <span>{t(atTable ? 'arcadeBackTables' : roomId !== undefined ? 'arcadeBackRooms' : 'arcadeCatalog')}</span>
        </Button>
        <ArcadeActionTarget />
        <div className="arcade-footer-actions">
          <ArcadeFooterTimer match={atTable ? match : undefined} />
          <Button onClick={() => setHelp(true)}>{t('arcadeHelp')}</Button>
        </div>
      </footer>
      {leaving.dialog}
      {legacyLeaving.dialog}
      {help && (
        <Dialog title={t('tienHelpTitle')} closeLabel={t('close')} onClose={() => setHelp(false)}>
          <p>{t('tienHelp1')}</p>
          <p>{t('tienHelp2')}</p>
          <p>{t('tienHelp3')}</p>
          <p>{t('tienHelp4')}</p>
          <p>{t('tienHelp5')}</p>
        </Dialog>
      )}
    </ArcadeActionProvider>
  );
}
