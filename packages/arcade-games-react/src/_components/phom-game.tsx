import type { PhomAction, PhomResult, PhomSnapshot } from '@chibi-town/arcade-games/phom-logic';
import { canEatPhom, phomRank, phomSendTargets, solvePhom } from '@chibi-town/arcade-games/phom-logic';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { ArcadeTableStart } from '@chibi-town/contracts/arcade-table';
import type { PhomCommand, PhomLobby } from '@chibi-town/contracts/phom';
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
import { PhomTable } from './phom-table.js';
import { TableSettings } from './table-settings.js';

export function PhomGame({ player, back, coins, refreshWallet, audio }: ArcadeGameProps) {
  const { t } = useTranslation('common');
  const { sdk } = useArcadeHost();
  const [lobby, setLobby] = useState<PhomLobby>();
  const [match, setMatch] = useState<PhomSnapshot>();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [help, setHelp] = useState(false);
  const [event, setEvent] = useState<PhomResult['steps'][number]>();
  const confirmed = useRef<PhomSnapshot | undefined>(undefined);
  const command = useRef<PhomCommand | undefined>(undefined);
  const roomRequest = useRef<ArcadeTableStart | undefined>(undefined);

  const { roomId, atTable, setRoomId, setAtTable } = useArcadeTableRoute('phom');
  const session = useTableSession();
  const { alive, locked, stale, loading } = session;

  async function replaySteps(steps: PhomResult['steps']) {
    for (const step of steps) {
      if (!alive.current) return;
      audio.play(step.action === 'eat' || step.action === 'lay' ? 'success' : 'select');
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
      const l = await sdk.getPhomLobby();
      if (alive.current) {
        setLobby(l);
        const closed = !!confirmed.current?.players && !l.activeMatch;
        if (closed) {
          setAtTable(false);
          setSelected([]);
          setRetry(false);
          command.current = undefined;
          setEvent(undefined);
          void refreshWallet();
        }
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
  useArcadeLive('phom', () => {
    if (locked.current) stale.current = true;
    else void load().then(refreshWallet);
  });

  const pause = (ms = 300) => session.pause(ms);

  async function join(roomId: number, tableId: number) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    if (roomRequest.current?.roomId !== roomId || roomRequest.current?.tableId !== tableId)
      roomRequest.current = { roomId, tableId, requestId: crypto.randomUUID(), prepare: true };
    try {
      const next = await sdk.startPhomRoom(roomRequest.current);
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

  async function send(action: PhomAction, isRetry = false) {
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
      const result = await sdk.playPhom(input);
      await replaySteps(result.steps);
      if (!alive.current) return;
      confirmed.current = result.match;
      setMatch(result.match);
      if (result.match.status === 'finished') audio.play(result.match.winner === 0 ? 'success' : 'close');
      setEvent(undefined);
      command.current = undefined;
      await refreshWallet();
      void sdk
        .getPhomLobby()
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
        setError(t('phomInvalidPlay'));
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
    gameId: 'phom',
    match: atTable ? confirmed.current : undefined,
    refreshWallet,
  });

  async function configured() {
    await load();
    await refreshWallet();
  }

  const canPlay =
    !!match && selected.length === 1 && match.phase === 'discard' && !match.eaten[0].includes(selected[0]);
  const sendTargets =
    match && match.phase === 'send'
      ? phomSendTargets(match).filter((target) => selected.length === 1 && target.card === selected[0])
      : [];
  const active = lobby?.activeMatch && lobby.activeMatch.status !== 'finished' ? lobby.activeMatch : undefined;
  const legacyLeaving = useLeaveTable({
    gameId: 'phom',
    match: !atTable && active && !active.session ? active : undefined,
    refreshWallet,
    interceptNavigation: false,
  });
  return (
    <ArcadeActionProvider>
      <CoinChange coins={coins} audio={audio} />
      <GameResultEffect match={atTable ? match : undefined} />
      <section
        className={`arcade-main arcade-main--tien ${atTable && match?.status === 'playing' ? 'arcade-main--phom-playing' : ''}`}
      >
        {!atTable && (
          <>
            {!lobby && <p role="status">{error || t('arcadeLoading')}</p>}
            {!lobby && error && <Button onClick={() => void load()}>{t('retry')}</Button>}
            {lobby && (
              <ArcadeDirectory
                gameId={'phom'}
                gameName={t('arcadeGameNames.phom')}
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
            gameId="phom"
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
          <PhomTable
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
                      disabled={busy || retry || match.turn !== 0 || match.phase !== 'discard'}
                      onClick={() => {
                        const rubbish = match.laid[0] ? match.hand : solvePhom(match.hand, match.eaten[0]).rubbish;
                        setSelected(
                          rubbish.length ? [rubbish.reduce((a, b) => (phomRank(a) > phomRank(b) ? a : b))] : [],
                        );
                      }}
                    >
                      {t('arcadeHint')}
                    </Button>
                  )}
                  <Button
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'receive' || !canEatPhom(match)}
                    onClick={() => void send({ type: 'eat' })}
                  >
                    {t('phomEat')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'receive'}
                    onClick={() => void send({ type: 'draw' })}
                  >
                    {t('phomDraw')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'discard' || !canPlay}
                    onClick={() => void send({ type: 'discard', card: selected[0] })}
                  >
                    {t('tienPlay')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'lay'}
                    onClick={() => void send({ type: 'lay' })}
                  >
                    {t('phomLay')}
                  </Button>
                  <Button
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'send' || !sendTargets.length}
                    onClick={() => void send({ type: 'send', ...sendTargets[0] })}
                  >
                    {t('phomSend')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || retry || match.turn !== 0 || match.phase !== 'send'}
                    onClick={() => void send({ type: 'done' })}
                  >
                    {t('phomDone')}
                  </Button>
                </ArcadeActions>
              )
            }
            toggle={(card) => {
              if (!retry) setSelected((current) => (current.includes(card) ? [] : [card]));
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
            <Button
              variant="primary"
              disabled={busy || retry || match.turn !== 0}
              onClick={() => void send({ type: 'start' })}
            >
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
      <footer
        className={`arcade-footer ${atTable && match?.status === 'playing' ? 'arcade-footer--phom-playing' : ''}`}
      >
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
        <Dialog title={t('phomHelpTitle')} closeLabel={t('close')} onClose={() => setHelp(false)}>
          <p>{t('phomHelp1')}</p>
          <p>{t('phomHelp2')}</p>
          <p>{t('phomHelp3')}</p>
          <p>{t('phomHelp4')}</p>
          <p>{t('phomHelp5')}</p>
        </Dialog>
      )}
    </ArcadeActionProvider>
  );
}
