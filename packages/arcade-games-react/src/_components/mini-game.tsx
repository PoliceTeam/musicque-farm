import {
  isMiniGameId,
  legalMiniMoves,
  type MiniAction,
  type MiniGameId,
  type MiniSnapshot,
} from '@chibi-town/arcade-games/mini-games-logic';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { MiniCommand, MiniLobby, MiniStart } from '@chibi-town/contracts/mini-games';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArcadeGameProps } from '../_utils/arcade-game-props.js';
import { roomNumber } from '../_utils/room-number.js';
import { unseenTableSteps } from '../_utils/table-updates.js';
import { useArcadeLive } from '../_utils/use-arcade-live.js';
import { useArcadeHost } from '../host.js';
import { ArcadeAvatar } from './arcade-avatar.js';
import { ArcadeDirectory } from './arcade-directory.js';
import { ChanceTable } from './chance-table.js';
import { CoinChange } from './coin-change.js';
import { useLeaveTable } from './leave-table-dialog.js';
import { TableSettings } from './table-settings.js';
import { TurnCountdown } from './turn-countdown.js';

const CHESS: Record<string, string> = {
  wk: '♔',
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  wp: '♙',
  bk: '♚',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
  bp: '♟',
};
const XIANGQI: Record<string, string> = {
  rk: '帥',
  ra: '仕',
  re: '相',
  rh: '傌',
  rr: '俥',
  rc: '炮',
  rp: '兵',
  bk: '將',
  ba: '士',
  be: '象',
  bh: '馬',
  br: '車',
  bc: '砲',
  bp: '卒',
};

export function MiniGame({
  gameId,
  player,
  coins,
  audio,
  back,
  refreshWallet,
}: ArcadeGameProps & { gameId: MiniGameId }) {
  const { t } = useTranslation('common'),
    { sdk } = useArcadeHost();
  const [lobby, setLobby] = useState<MiniLobby>(),
    [match, setMatch] = useState<MiniSnapshot>(),
    [roomId, setRoomId] = useState<number>(),
    [atTable, setAtTable] = useState(false),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false),
    [error, setError] = useState(''),
    [help, setHelp] = useState(false),
    [selected, setSelected] = useState<number>(),
    [choice, setChoice] = useState(0),
    [reveal, setReveal] = useState<number[]>(),
    [promotionTarget, setPromotionTarget] = useState<number>();
  const confirmed = useRef<MiniSnapshot | undefined>(undefined),
    command = useRef<MiniCommand | undefined>(undefined),
    startRequest = useRef<MiniStart | undefined>(undefined),
    alive = useRef(false),
    locked = useRef(false);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const chance = gameId === 'bau-cua' || gameId === 'slots';

  async function replaySteps(steps: MiniSnapshot[], remote = false) {
    if (remote && chance && steps.at(-1)?.roll) {
      audio.play(gameId === 'bau-cua' ? 'dice-roll' : 'reel-spin');
      setReveal(steps.at(-1)?.roll);
      await pause();
    }
    for (const step of steps) {
      if (!alive.current) return;
      setMatch(step);
      setSelected(undefined);
      if (!chance) audio.play('select');
      if (!chance && (remote || (step.turn === 1 && step.status === 'playing'))) await pause();
    }
  }

  const loading = useRef(false);

  async function load() {
    if (loading.current) {
      stale.current = true;
      return;
    }
    loading.current = true;
    try {
      const l = await sdk.getMiniLobby(gameId);
      if (alive.current) {
        const closed = !!confirmed.current?.players && !l.activeMatch;
        if (closed) {
          setAtTable(false);
          setSelected(undefined);
          setPromotionTarget(undefined);
          setRetry(false);
          command.current = undefined;
          void refreshWallet();
        }
        setLobby(l);
        const previous = confirmed.current,
          next = l.activeMatch;
        const steps = unseenTableSteps(previous, next);
        if (previous && steps.length && !locked.current) {
          locked.current = true;
          setBusy(true);
          try {
            await replaySteps(steps, true);
          } finally {
            locked.current = false;
            if (alive.current) setBusy(false);
          }
          if (!alive.current) return;
        }
        setMatch(l.activeMatch);
        if (l.activeMatch?.id !== confirmed.current?.id || l.activeMatch?.choice !== confirmed.current?.choice)
          setChoice(l.activeMatch?.choice ?? 0);
        setReveal(undefined);
        confirmed.current = l.activeMatch;
        setError(closed ? t('arcadeTableClosed') : '');
      }
    } catch {
      if (alive.current) setError(t('arcadeLoadFailed'));
    } finally {
      loading.current = false;
      if (stale.current && alive.current && !locked.current) {
        stale.current = false;
        void load();
      }
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: Module game ID and SDK are fixed for this mount; retries call load explicitly.
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      for (const [timer, resolve] of timers.current) {
        clearTimeout(timer);
        resolve();
      }
      timers.current.clear();
    };
  }, []);
  const stale = useRef(false);
  useArcadeLive(gameId, () => {
    if (locked.current) stale.current = true;
    else void load().then(refreshWallet);
  });

  async function pause() {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          resolve();
        },
        chance ? 2200 : 350,
      );
      timers.current.set(timer, resolve);
    });
  }

  async function join(room: number, table: number) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    if (startRequest.current?.roomId !== room || startRequest.current?.tableId !== table)
      startRequest.current = { gameId, roomId: room, tableId: table, requestId: crypto.randomUUID(), prepare: true };
    try {
      const next = await sdk.startMiniRoom(startRequest.current);
      if (!alive.current) return;
      confirmed.current = next;
      setMatch(next);
      setAtTable(true);
      setRoomId(room);
      setChoice(next.choice ?? 0);
      setSelected(undefined);
      setReveal(undefined);
      startRequest.current = undefined;
      setRetry(false);
    } catch {
      if (alive.current) setError(t('arcadeStartFailed'));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (stale.current && alive.current) {
        stale.current = false;
        void load();
      }
    }
  }

  async function send(action: MiniAction, isRetry = false) {
    const source = confirmed.current;
    if (!source || locked.current || (chance && source.players && source.session?.hostId !== player.id)) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setRetry(false);
    const input =
      isRetry && command.current
        ? command.current
        : { gameId, matchId: source.id, revision: source.revision, requestId: crypto.randomUUID(), action };
    command.current = input;
    if (action.type === 'roll' || action.type === 'spin')
      audio.play(action.type === 'roll' ? 'dice-roll' : 'reel-spin');
    if (chance && ['roll', 'spin'].includes(action.type)) setReveal(undefined);
    try {
      const result = await sdk.playMini(input);
      if (chance && ['roll', 'spin'].includes(action.type)) {
        if (!alive.current) return;
        setReveal(result.match.roll);
        await pause();
      }
      await replaySteps(result.steps);
      if (!alive.current) return;
      setReveal(undefined);
      confirmed.current = result.match;
      setMatch(result.match);
      command.current = undefined;
      await refreshWallet();
      if (result.match.status === 'finished') audio.play(result.match.outcome === 'win' ? 'success' : 'close');
      void sdk
        .getMiniLobby(gameId)
        .then((l) => {
          if (alive.current) setLobby(l);
        })
        .catch(() => {});
    } catch (failure) {
      if (!alive.current) return;
      setMatch(source);
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'REQUEST_CONFLICT') {
        command.current = undefined;
        setError(t('tienStale'));
        void load();
      } else if (['INVALID_PLAY', 'INVALID_TURN', 'MATCH_FINISHED', 'INSUFFICIENT_COINS'].includes(code)) {
        command.current = undefined;
        setError(t(code === 'INSUFFICIENT_COINS' ? 'arcadeNoCoins' : 'miniInvalidMove'));
      } else {
        setRetry(true);
        setError(t('tienRequestFailed'));
      }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
      if (stale.current && alive.current) {
        stale.current = false;
        void load();
      }
    }
  }

  const leaving = useLeaveTable({
    disabled: busy,
    gameId,
    playerId: player.id,
    match: atTable ? confirmed.current : undefined,
    refreshWallet,
  });

  async function configured() {
    await load();
    await refreshWallet();
  }

  const active = lobby?.activeMatch && lobby.activeMatch.status !== 'finished' ? lobby.activeMatch : undefined;
  const legal = match && !chance ? legalMiniMoves(match) : [];

  function square(index: number) {
    if (!match || busy || retry || match.turn !== (match.side ?? 0) || match.status !== 'playing') return;
    if (selected !== undefined) {
      const options = legal.filter((m) => m.from === selected && m.to === index);
      if (options.length) {
        if (options.some((m) => m.promotion)) {
          setPromotionTarget(index);
          return;
        }
        void send({ type: 'move', from: selected, to: index });
        return;
      }
    }
    const own = match.board[index]?.[0] === (match.side === 1 ? 'b' : gameId === 'chess' ? 'w' : 'r');
    setSelected(own ? (selected === index ? undefined : index) : undefined);
  }

  const chanceRolling =
    busy && chance && (!!reveal || (!!command.current && ['roll', 'spin'].includes(command.current.action.type)));
  const columns = gameId === 'chess' ? 8 : 9;
  const names = gameId === 'chess' ? CHESS : XIANGQI;
  const tableActions = (
    <>
      {atTable && match?.status === 'playing' && !chance && match.session?.mode === 'practice' && (
        <Button disabled={busy || retry} onClick={() => setSelected(legal[0]?.from)}>
          {t('arcadeHint')}
        </Button>
      )}
      {atTable && match?.status === 'finished' && !chance && (
        <Button variant="primary" disabled={busy} onClick={() => void join(match.roomId, match.tableId)}>
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
    </>
  );
  return (
    <>
      <CoinChange coins={coins} audio={audio} />
      <section className="arcade-main arcade-main--mini">
        {!atTable &&
          (!lobby ? (
            <section>
              <p role="status">{error || t('arcadeLoading')}</p>
              {error && <Button onClick={() => void load()}>{t('retry')}</Button>}
            </section>
          ) : (
            <ArcadeDirectory
              gameName={t(`arcadeGameNames.${gameId}`)}
              rooms={lobby.rooms}
              roomId={roomId}
              active={active}
              busy={busy}
              selectRoom={setRoomId}
              join={(room, table) => void join(room, table)}
            />
          ))}
        {atTable && match && (
          <>
            {!chance && (
              <TableSettings
                key={match.id}
                gameId={gameId}
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
            <div className={`mini-game-surface ${chance ? 'is-chance' : 'is-board'}`}>
              <div className="mini-table-heading">
                <h2>{t(`arcadeGameNames.${gameId}`)}</h2>
                <span>{t('arcadeSeatTitle', { room: roomNumber(match.roomId), table: match.tableId + 1 })}</span>
              </div>
              <p className="mini-status" role="status">
                {match.status === 'waiting'
                  ? t('miniReady')
                  : match.status === 'finished'
                    ? t(`miniOutcomes.${match.outcome ?? 'draw'}`)
                    : busy
                      ? t('miniBotThinking')
                      : chance
                        ? t(gameId === 'bau-cua' ? 'miniChooseAnimal' : 'miniSpinPrompt')
                        : match.turn !== (match.side ?? 0)
                          ? t('tienTurnOf', { name: tablePlayerName(match.players?.[1]) ?? t('miniBot') })
                          : t(match.check ? 'miniInCheck' : 'miniYourTurn')}
                {!chance && !busy && match.status === 'playing' && (
                  <>
                    {' · '}
                    <TurnCountdown match={match} active />
                  </>
                )}
              </p>
              {match.status === 'waiting' && retry && <div className="arcade-local-actions">{tableActions}</div>}
              {match.status === 'finished' && match.reason && (
                <p className="mini-result-reason">{t(`miniReasons.${match.reason}`)}</p>
              )}
              {!chance && match.board.length > 0 && (
                <>
                  <div className="mini-opponents">
                    <span>
                      <ArcadeAvatar outfit={player.outfit} label={tablePlayerName(player)!} />
                      {tablePlayerName(player)!}
                    </span>
                    <span>
                      <ArcadeAvatar
                        outfit={match.players?.[1]?.outfit ?? defaultOutfit}
                        label={tablePlayerName(match.players?.[1]) ?? t('miniBot')}
                      />
                      {tablePlayerName(match.players?.[1]) ?? t('miniBot')}
                    </span>
                  </div>
                  <fieldset
                    className={`mini-board ${gameId === 'chess' ? 'is-chess' : 'is-xiangqi'}`}
                    aria-label={t(`arcadeGameNames.${gameId}`)}
                    style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}
                  >
                    {gameId === 'chinese-chess' && (
                      <svg
                        className="mini-xiangqi-lines"
                        viewBox="0 0 9 10"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {Array.from({ length: 10 }, (_, y) => y).map((y) => (
                          <line key={`h${y}`} x1="0.5" x2="8.5" y1={y + 0.5} y2={y + 0.5} />
                        ))}
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((x) => (
                          <g key={`v${x}`}>
                            <line x1={x + 0.5} x2={x + 0.5} y1="0.5" y2={x === 0 || x === 8 ? 9.5 : 4.5} />
                            {x !== 0 && x !== 8 && <line x1={x + 0.5} x2={x + 0.5} y1="5.5" y2="9.5" />}
                          </g>
                        ))}
                        <path d="M3.5 .5 L5.5 2.5 M5.5 .5 L3.5 2.5 M3.5 7.5 L5.5 9.5 M5.5 7.5 L3.5 9.5" />
                      </svg>
                    )}
                    {Array.from({ length: match.board.length }, (_, displayIndex) => {
                      const index = match.side === 1 ? match.board.length - 1 - displayIndex : displayIndex;
                      const piece = match.board[index];
                      const x = index % columns,
                        y = Math.floor(index / columns),
                        position = gameId === 'chess' ? `${'abcdefgh'[x]}${8 - y}` : `${x + 1},${y + 1}`;
                      const destination =
                        selected !== undefined && legal.some((m) => m.from === selected && m.to === index);
                      const last = match.moves.at(-1),
                        lastMove = last?.from === index || last?.to === index;
                      return (
                        <button
                          key={position}
                          type="button"
                          className={`mini-square ${(x + y) % 2 ? 'is-dark' : 'is-light'} ${piece ? 'has-piece' : ''} ${piece?.[0] === 'r' || piece?.[0] === 'w' ? 'is-player' : 'is-bot'} ${selected === index ? 'is-selected' : ''} ${destination ? 'is-destination' : ''} ${lastMove ? 'is-last-move' : ''}`}
                          disabled={busy || retry || match.turn !== (match.side ?? 0) || match.status !== 'playing'}
                          aria-label={t('miniSquareLabel', {
                            position,
                            piece: piece
                              ? t(
                                  `miniPieces.${gameId === 'chess' ? 'chess' : 'xiangqi'}.${piece[1] as 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'h' | 'e' | 'a' | 'c'}` as Parameters<
                                    typeof t
                                  >[0],
                                )
                              : t('miniEmpty'),
                          })}
                          aria-pressed={selected === index}
                          data-ui-sound="select"
                          onClick={() => square(index)}
                          onKeyDown={(event) => {
                            const delta =
                              event.key === 'ArrowLeft'
                                ? -1
                                : event.key === 'ArrowRight'
                                  ? 1
                                  : event.key === 'ArrowUp'
                                    ? -columns
                                    : event.key === 'ArrowDown'
                                      ? columns
                                      : 0;
                            if (!delta) return;
                            event.preventDefault();
                            const cells =
                              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
                            cells?.[Math.max(0, Math.min(match.board.length - 1, displayIndex + delta))]?.focus();
                          }}
                        >
                          <span>{piece ? names[piece] : ''}</span>
                          {destination && !piece && <i aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </fieldset>
                  {gameId === 'chinese-chess' && <p className="mini-river-label">{t('miniRiver')}</p>}
                  <p className="mini-board-help">
                    {t(
                      match.side === undefined
                        ? 'miniMoveHelp'
                        : match.side === 0
                          ? 'miniMoveHelpFirst'
                          : 'miniMoveHelpSecond',
                    )}
                  </p>
                  <div className="arcade-local-actions">{tableActions}</div>
                </>
              )}
              {chance && (
                <>
                  <TurnCountdown match={match} active={match.players?.[0]?.id === match.session?.hostId} prominent />
                  <ChanceTable
                    gameId={gameId === 'bau-cua' ? 'bau-cua' : 'slots'}
                    roll={chanceRolling ? reveal : match.roll}
                    busy={chanceRolling}
                    actions={
                      <>
                        {match.status === 'playing' ? (
                          <Button
                            variant="primary"
                            disabled={busy || retry || (!!match.players && match.session?.hostId !== player.id)}
                            onClick={() =>
                              void send(gameId === 'bau-cua' ? { type: 'roll', symbol: choice } : { type: 'spin' })
                            }
                          >
                            {t(gameId === 'bau-cua' ? 'miniRoll' : 'miniSpin')}
                          </Button>
                        ) : match.status !== 'finished' ? (
                          <TableSettings
                            key={match.id}
                            gameId={gameId}
                            choice={gameId === 'bau-cua' ? choice : undefined}
                            match={match}
                            playerId={player.id}
                            name={tablePlayerName(player)!}
                            coins={lobby?.availableCoins ?? coins}
                            changed={configured}
                            locked={busy || retry}
                            players={match.players}
                            onStart={() =>
                              send(gameId === 'bau-cua' ? { type: 'roll', symbol: choice } : { type: 'spin' })
                            }
                          />
                        ) : (
                          <Button
                            variant="primary"
                            disabled={busy || retry || (!!match.players && match.session?.hostId !== player.id)}
                            onClick={() => void send({ type: 'next-round' })}
                          >
                            {t('arcadeNextRound')}
                          </Button>
                        )}
                        {match.status === 'finished' && match.session?.housePayouts && (
                          <ul className="arcade-house-results">
                            {match.session.housePayouts.map((p) => (
                              <li key={p.memberId} className={p.delta > 0 ? 'is-gain' : p.delta < 0 ? 'is-loss' : ''}>
                                {t('arcadeMemberResult', {
                                  name:
                                    p.memberId === player.id
                                      ? tablePlayerName(player)!
                                      : (tablePlayerName(match.players?.find((entry) => entry.id === p.memberId)) ??
                                        t('arcadeLocalBot', {
                                          number: match.session!.members!.findIndex((m) => m.id === p.memberId),
                                        })),
                                  delta: `${p.delta > 0 ? '+' : ''}${p.delta.toLocaleString('vi-VN')}`,
                                  coins: p.coinsAfter.toLocaleString('vi-VN'),
                                })}
                              </li>
                            ))}
                          </ul>
                        )}
                        {tableActions}
                      </>
                    }
                    finished={match.status === 'finished'}
                    choice={choice}
                    choose={setChoice}
                    disabled={
                      busy ||
                      retry ||
                      match.status === 'finished' ||
                      !!(match.players
                        ? match.session?.members?.find((m) => m.id === player.id)?.ready
                        : (match.session?.members?.[0]?.ready ?? match.session?.configured))
                    }
                    play={() => void send(gameId === 'bau-cua' ? { type: 'roll', symbol: choice } : { type: 'spin' })}
                  />
                </>
              )}
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="tien-error">
            {error}
          </p>
        )}
      </section>
      <footer className="arcade-footer">
        <Button
          disabled={busy || leaving.busy}
          aria-label={t('arcadeBack')}
          onClick={() => {
            if (atTable)
              leaving.request(() => {
                confirmed.current = undefined;
                setMatch(undefined);
                setAtTable(false);
                setSelected(undefined);
                void load();
              });
            else if (roomId !== undefined) setRoomId(undefined);
            else back();
          }}
        >
          <span aria-hidden="true">❮</span>
          <span>{t(atTable ? 'arcadeBackTables' : roomId !== undefined ? 'arcadeBackRooms' : 'arcadeCatalog')}</span>
        </Button>
        <div className="arcade-footer-actions">
          <Button onClick={() => setHelp(true)}>{t('arcadeHelp')}</Button>
        </div>
      </footer>
      {leaving.dialog}
      {promotionTarget !== undefined && selected !== undefined && (
        <Dialog title={t('miniPromotion')} closeLabel={t('close')} onClose={() => setPromotionTarget(undefined)}>
          {(['q', 'r', 'b', 'n'] as const).map((piece) => (
            <Button
              key={piece}
              onClick={() => {
                const target = promotionTarget;
                setPromotionTarget(undefined);
                void send({ type: 'move', from: selected, to: target, promotion: piece });
              }}
            >
              {t(`miniPieces.chess.${piece}`)}
            </Button>
          ))}
        </Dialog>
      )}
      {help && (
        <Dialog title={t(`arcadeGameNames.${gameId}`)} closeLabel={t('close')} onClose={() => setHelp(false)}>
          <p>{t(`miniHelpTexts.${gameId}`)}</p>
          <p>{t('miniCommonHelp')}</p>
        </Dialog>
      )}
    </>
  );
}

export function miniGameView(gameId: MiniGameId) {
  if (!isMiniGameId(gameId)) throw new Error('Invalid game module');
  return function RegisteredMiniGame(props: ArcadeGameProps) {
    return <MiniGame {...props} gameId={gameId} />;
  };
}
