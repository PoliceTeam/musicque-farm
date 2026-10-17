import {
  adjacentGems,
  GEM_TYPES,
  type GemAction,
  type GemBattleSnapshot,
  type GemStep,
  validGemMoves,
} from '@chibi-town/arcade-games/gem-battle-logic';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { ArcadeLobby, DiamondCommand } from '@chibi-town/contracts/arcade';
import type { ArcadeTableStart } from '@chibi-town/contracts/arcade-table';
import { DIAMOND_RULES } from '@chibi-town/game-content/arcade-catalog';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArcadeGameProps } from '../_utils/arcade-game-props.js';
import { readArcadeRoute, useArcadeTableRoute } from '../_utils/arcade-route.js';
import { clearTable } from '../_utils/clear-table.js';
import { GEM_REPLAY_TIMING, type GemReplay } from '../_utils/gem-replay.js';
import { roomNumber } from '../_utils/room-number.js';
import { unseenTableSteps } from '../_utils/table-updates.js';
import { useArcadeLive } from '../_utils/use-arcade-live.js';
import { useTableSession } from '../_utils/use-table-session.js';
import { useArcadeHost } from '../host.js';
import { ArcadeActionProvider, ArcadeActions, ArcadeActionTarget, ArcadeFooterTimer } from './arcade-actions.js';
import { ArcadeDirectory } from './arcade-directory.js';
import { CoinChange } from './coin-change.js';
import { GameResultEffect } from './game-result-effect.js';
import { GemArena } from './gem-arena.js';
import { GemImage } from './gem-image.js';
import { useLeaveTable } from './leave-table-dialog.js';
import { TableSettings } from './table-settings.js';

export function DiamondsGame({ audio, player, coins, back, refreshWallet }: ArcadeGameProps) {
  const { t } = useTranslation('common');
  const { sdk } = useArcadeHost();
  const [lobby, setLobby] = useState<ArcadeLobby>();
  const route = useArcadeTableRoute('diamonds');
  const roomId = route.roomId ?? 0;
  const setRoomId = route.setRoomId;
  const view = route.atTable ? 'battle' : route.roomId === undefined ? 'rooms' : 'tables';

  const setView = (value: 'rooms' | 'tables') => {
    if (value === 'rooms') route.setRoomId(undefined);
    else route.setAtTable(false);
  };

  const [battle, setBattle] = useState<GemBattleSnapshot>();
  const confirmed = useRef<GemBattleSnapshot | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [hinted, setHinted] = useState<number[]>([]);
  const [flashing, setFlashing] = useState<number[]>([]);
  const [step, setStep] = useState<GemStep>();
  const [replay, setReplay] = useState<GemReplay>();
  const [notice, setNotice] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const lastCommand = useRef<DiamondCommand | undefined>(undefined);
  const startRequest = useRef<ArcadeTableStart | undefined>(undefined);

  const session = useTableSession();
  const { alive, locked, stale, replayId } = session;

  async function replaySteps(steps: GemStep[], source: GemBattleSnapshot) {
    for (const nextStep of steps) {
      if (!alive.current) return;
      const id = ++replayId.current;
      setReplay({ id, phase: 'prepare', step: nextStep });
      setStep(undefined);
      if (nextStep.beforeBoard)
        setBattle((current) => (current ? { ...current, board: nextStep.beforeBoard! } : current));
      await pause(nextStep.actor === 'bot' && nextStep.combo <= 1 ? GEM_REPLAY_TIMING.bot : GEM_REPLAY_TIMING.prepare);
      if (!alive.current) return;
      setStep(nextStep);
      setReplay({ id, phase: 'clear', step: nextStep });
      setFlashing(nextStep.cleared);
      audio.play(nextStep.combo > 1 || nextStep.extraTurn ? 'success' : 'click');
      await pause(GEM_REPLAY_TIMING.clear);
      if (!alive.current) return;
      setBattle({
        ...source,
        board: nextStep.board,
        player: nextStep.player,
        bot: nextStep.bot,
        score: nextStep.score,
      });
      setFlashing([]);
      setReplay({ id, phase: 'fall', step: nextStep });
      await pause(GEM_REPLAY_TIMING.fall);
      if (!alive.current) return;
      setReplay(undefined);
      await pause(GEM_REPLAY_TIMING.settle + (nextStep.extraTurn ? GEM_REPLAY_TIMING.reward : 0));
    }
    setStep(undefined);
    setReplay(undefined);
  }

  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload explicitly retries the SDK load.
  useEffect(() => {
    session.activate();
    let disposed = false;
    void sdk
      .getArcadeLobby()
      .then(async (next) => {
        if (disposed) return;
        const closed = !!confirmed.current?.players && !next.activeBattle;
        if (closed) {
          setView('tables');
          setSelected(undefined);
          setHinted([]);
          void refreshWallet();
        }
        setLobby(next);
        const previous = confirmed.current,
          target = next.activeBattle;
        const steps = unseenTableSteps(previous, target);
        if (previous && steps.length && !locked.current) {
          locked.current = true;
          setBusy(true);
          try {
            await replaySteps(steps, previous);
          } finally {
            locked.current = false;
            if (!disposed) setBusy(false);
          }
          if (disposed) return;
        }
        confirmed.current = next.activeBattle;
        setBattle(next.activeBattle);
        const location = readArcadeRoute();
        if (
          location.table !== undefined &&
          (!next.activeBattle ||
            next.activeBattle.roomId !== location.room ||
            (next.activeBattle.tableId ?? 0) !== location.table)
        )
          route.setAtTable(false);
        setError(closed ? t('arcadeTableClosed') : '');
        setCanRetry(false);
        lastCommand.current = undefined;
        if (stale.current) {
          stale.current = false;
          setReload((n) => n + 1);
        }
      })
      .catch(() => {
        if (!disposed) setError(t('arcadeLoadFailed'));
      });
    return () => {
      disposed = true;
      session.dispose();
    };
  }, [reload, t]);
  useArcadeLive('diamonds', () => {
    if (locked.current) stale.current = true;
    else {
      setReload((n) => n + 1);
      void refreshWallet();
    }
  });

  const pause = (ms = 0) => session.pause(ms);

  async function refreshLobby() {
    const next = await sdk.getArcadeLobby();
    if (alive.current) setLobby(next);
  }

  async function start(roomId: number, tableId: number) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    if (startRequest.current?.roomId !== roomId || startRequest.current?.tableId !== tableId)
      startRequest.current = { roomId, tableId, requestId: crypto.randomUUID(), prepare: true };
    try {
      const next = await sdk.startDiamondRoom(startRequest.current);
      if (!alive.current) return;
      confirmed.current = next;
      setBattle(next);
      route.setAtTable(true, next.tableId ?? 0, next.roomId);
      setCanRetry(false);
      lastCommand.current = undefined;
      setSelected(undefined);
      setHinted([]);
      setStep(undefined);
      setReplay(undefined);
      setFlashing([]);
      startRequest.current = undefined;
      audio.play('enter');
      await refreshLobby().catch(() => {});
      await refreshWallet();
    } catch (failure) {
      if (alive.current)
        setError(
          t(
            failure instanceof Error && failure.message === 'CHANNEL_FULL'
              ? 'arcadeRoomFull'
              : failure instanceof Error && failure.message === 'MATCH_IN_PROGRESS'
                ? 'arcadeMatchActive'
                : 'arcadeStartFailed',
          ),
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (session.consumeStale()) {
        setReload((n) => n + 1);
      }
    }
  }

  async function send(action: GemAction, retry = false) {
    const source = confirmed.current;
    if (
      !source ||
      (source.status !== 'playing' && !(source.status === 'waiting' && action.type === 'start')) ||
      locked.current ||
      (action.type !== 'start' && source.turn === 1)
    )
      return;
    locked.current = true;
    setNotice('');
    const command =
      retry && lastCommand.current
        ? lastCommand.current
        : { requestId: crypto.randomUUID(), battleId: source.id, revision: source.revision, action };
    lastCommand.current = command;
    setBusy(true);
    setError('');
    setCanRetry(false);
    setSelected(undefined);
    setHinted([]);
    try {
      const result = await sdk.playDiamond(command);
      if (!alive.current) return;
      if (action.type === 'swap') {
        const board = [...source.board];
        [board[action.from], board[action.to]] = [board[action.to], board[action.from]];
        setBattle({ ...source, board });
        audio.play('select');
        await pause(GEM_REPLAY_TIMING.swap);
      }
      await replaySteps(result.steps, source);
      if (!alive.current) return;
      confirmed.current = result.battle;
      setBattle(result.battle);
      setNotice(t(result.extraTurn ? 'arcadeExtraTurn' : result.reshuffled ? 'arcadeReshuffled' : 'arcadeYourTurn'));
      setStep(undefined);
      setReplay(undefined);
      audio.play(result.battle.status === 'lost' ? 'error' : 'success');
      lastCommand.current = undefined;
      await refreshLobby().catch(() => {});
      await refreshWallet();
    } catch (failure) {
      if (!alive.current) return;
      setBattle(source);
      setStep(undefined);
      setReplay(undefined);
      setFlashing([]);
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'NO_MATCH' || code === 'INVALID_MOVE') {
        setError(t('arcadeNoMatch'));
        lastCommand.current = undefined;
      } else if (code === 'NOT_ENOUGH_MANA' || code === 'INSUFFICIENT_COINS') {
        setError(t(code === 'INSUFFICIENT_COINS' ? 'arcadeNoCoins' : 'arcadeNeedMana'));
        lastCommand.current = undefined;
      } else if (code === 'REQUEST_CONFLICT' || code === 'MATCH_FINISHED') {
        lastCommand.current = undefined;
        setReload((n) => n + 1);
      } else {
        setError(t('arcadeTurnFailed'));
        setCanRetry(true);
      }
      audio.play('error');
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (session.consumeStale()) {
        setReload((n) => n + 1);
      }
    }
  }

  function select(index: number) {
    if (busy || canRetry || battle?.turn === 1) return;
    if (selected === undefined) {
      setSelected(index);
      return;
    }
    if (index === selected) {
      setSelected(undefined);
      return;
    }
    if (adjacentGems(selected, index)) void send({ type: 'swap', from: selected, to: index });
    else setSelected(index);
  }

  const leaving = useLeaveTable({
    onLeft: () => setReload((value) => value + 1),

    disabled: busy,
    gameId: 'diamonds',
    match: view === 'battle' ? confirmed.current : undefined,
    refreshWallet,
  });

  async function configured() {
    const l = await sdk.getArcadeLobby();
    setLobby(l);
    confirmed.current = l.activeBattle;
    setBattle(l.activeBattle);
    await refreshWallet();
  }

  function goBack() {
    setError('');
    if (view === 'battle')
      leaving.request(() => {
        setLobby((l) => (l ? { ...l, activeBattle: undefined, rooms: clearTable(l.rooms, confirmed.current) } : l));
        confirmed.current = undefined;
        setBattle(undefined);
        setView('tables');
        void refreshLobby().catch(() => {});
      });
    else if (view === 'tables') setView('rooms');
    else back();
  }

  const active =
    lobby?.activeBattle && ['waiting', 'playing'].includes(lobby.activeBattle.status) ? lobby.activeBattle : undefined;
  const legacyLeaving = useLeaveTable({
    gameId: 'diamonds',
    match: view !== 'battle' && active && !active.session ? active : undefined,
    refreshWallet,
    interceptNavigation: false,
  });
  const battleActions = (
    <ArcadeActions>
      {view === 'battle' && battle && (
        <>
          {battle.status === 'waiting' && !battle.session && (
            <Button variant="primary" disabled={busy || canRetry} onClick={() => void send({ type: 'start' })}>
              {t('tienStart')}
            </Button>
          )}
          {['won', 'lost'].includes(battle.status) && (
            <Button variant="primary" disabled={busy} onClick={() => void start(battle.roomId, battle.tableId ?? 0)}>
              {t('arcadePlayAgain')}
            </Button>
          )}
          {canRetry ? (
            <Button
              disabled={busy}
              onClick={() => {
                if (lastCommand.current) void send(lastCommand.current.action, true);
              }}
            >
              {t('retry')}
            </Button>
          ) : (
            battle.status === 'playing' &&
            battle.session?.mode === 'practice' && (
              <Button
                disabled={busy || canRetry || battle.turn !== 0 || battle.status !== 'playing'}
                onClick={() => {
                  const move = validGemMoves(battle.board)[0];
                  if (move) setHinted([move.from, move.to]);
                }}
              >
                {t('arcadeHint')}
              </Button>
            )
          )}
          {battle.status === 'playing' && (
            <Button
              variant="primary"
              disabled={busy || canRetry || battle.turn !== 0 || battle.player.mana < DIAMOND_RULES.skillCost}
              onClick={() => void send({ type: 'skill' })}
            >
              {t('arcadeSkill', { cost: DIAMOND_RULES.skillCost })}
            </Button>
          )}
        </>
      )}
    </ArcadeActions>
  );
  return (
    <ArcadeActionProvider>
      <CoinChange coins={coins} audio={audio} />
      <GameResultEffect match={view === 'battle' ? battle : undefined} />
      <section className={`arcade-main ${view === 'battle' ? 'arcade-main--battle' : ''}`}>
        {!lobby && (
          <section className="arcade-load">
            <p role="status">{error || t('arcadeLoading')}</p>
            {error && <Button onClick={() => setReload((n) => n + 1)}>{t('retry')}</Button>}
          </section>
        )}
        {lobby && (view === 'rooms' || view === 'tables') && (
          <>
            <ArcadeDirectory
              gameId={'diamonds'}
              gameName={t('arcadeGameNames.diamonds')}
              rooms={lobby.rooms}
              roomId={view === 'tables' ? roomId : undefined}
              active={active}
              busy={busy || legacyLeaving.busy}
              leaveLegacy={() =>
                legacyLeaving.request(() => {
                  setRoomId(active!.roomId);
                  setLobby((l) => (l ? { ...l, activeBattle: undefined, rooms: clearTable(l.rooms, active) } : l));
                  confirmed.current = undefined;
                  setBattle(undefined);
                  setView('tables');
                  void refreshLobby().catch(() => {});
                })
              }
              selectRoom={(id) => {
                setRoomId(id);
                setView('tables');
                setError('');
                audio.play('select');
              }}
              join={(room, table) => void start(room, table)}
            />
            {error && (
              <p className="arcade-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        {view === 'battle' && battle && (
          <TableSettings
            key={battle.id}
            gameId="diamonds"
            match={battle}
            playerId={player.id}
            name={tablePlayerName(player)!}
            coins={lobby?.availableCoins ?? coins}
            changed={configured}
            locked={busy || canRetry}
            players={battle.players}
            onStart={() => send({ type: 'start' })}
          />
        )}
        {view === 'battle' && battle?.status === 'waiting' && (
          <section className="arcade-ready">
            <h2>{t('arcadeGameNames.diamonds')}</h2>
            <p>{t('arcadeSeatTitle', { room: roomNumber(battle.roomId), table: (battle.tableId ?? 0) + 1 })}</p>
            <p>{battle.players ? t('tienWaitingPeople', { count: battle.players.length }) : t('arcadeBotsReady')}</p>
          </section>
        )}
        {view === 'battle' && battle && battle.status !== 'waiting' && player && (
          <GemArena
            actions={battleActions}
            battle={battle}
            outfit={player.outfit}
            name={tablePlayerName(player)!}
            busy={busy}
            step={step}
            replay={replay}
            selected={selected}
            hinted={hinted}
            flashing={flashing}
            error={error}
            notice={notice}
            onSelect={select}
            onSwap={(from, to) => {
              if (!canRetry) void send({ type: 'swap', from, to });
            }}
          />
        )}
        {view === 'battle' && battle?.status === 'waiting' && battleActions}
      </section>
      <footer className="arcade-footer">
        <Button disabled={busy || leaving.busy || legacyLeaving.busy} onClick={goBack} aria-label={t('arcadeBack')}>
          <span aria-hidden="true">❮</span>
          <span>
            {t(view === 'battle' ? 'arcadeBackTables' : view === 'tables' ? 'arcadeBackRooms' : 'arcadeCatalog')}
          </span>
        </Button>
        <ArcadeActionTarget />
        <div className="arcade-footer-actions">
          <ArcadeFooterTimer match={view === 'battle' ? battle : undefined} />
          <Button onClick={() => setHelp(true)}>{t('arcadeHelp')}</Button>
        </div>
      </footer>
      {leaving.dialog}
      {legacyLeaving.dialog}
      {help && (
        <Dialog title={t('arcadeHelpTitle')} closeLabel={t('close')} onClose={() => setHelp(false)}>
          <p>{t('arcadeHelpDescription')}</p>
          <div className="arcade-gem-guide">
            {GEM_TYPES.map((gem) => (
              <div key={gem}>
                <GemImage gem={gem} />
                <p>
                  <strong>{t(`arcadeGems.${gem}`)}</strong>
                  <span>{t(`arcadeGemHelp.${gem}`)}</span>
                </p>
              </div>
            ))}
          </div>
          <p>{t('arcadeComboHelp')}</p>
          <p>{t('arcadeSkillHelp')}</p>
        </Dialog>
      )}
    </ArcadeActionProvider>
  );
}
