import { RACE_COUNTDOWN, type RaceResult, type RaceRound, racePhase } from '@chibi-town/contracts/pet-racing';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { Button } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk } from '@/application/api-sdk';
import { petRacingCss } from '@/assets/generated-styles/pet-racing-css';
import { RaceBetDialog } from '@/features/pet-racing/_components/race-bet-dialog';
import { RaceBetSummary } from '@/features/pet-racing/_components/race-bet-summary';
import { RaceResultDialog } from '@/features/pet-racing/_components/race-result-dialog';
import { RaceSettlementSummary } from '@/features/pet-racing/_components/race-settlement-summary';
import { usePetRace } from '@/features/pet-racing/_utils/use-pet-race';
import { createRaceView } from '@/features/pet-racing/rendering/race-view';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

export const styles = petRacingCss;

export function Screen({ audio }: { audio: ReturnType<typeof createGameAudio> }) {
  const navigation = useRouter();
  const [player, setPlayer] = useState<LocationPlayer>();
  const [gems, setGems] = useState<number>();
  useEffect(() => {
    let alive = true;
    void Promise.all([getApiSdk().getPlayer(), getApiSdk().getInventory()])
      .then(([account, inventory]) => {
        if (!alive) return;
        setPlayer(account);
        setGems(inventory.farm.gems);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const onClose = () => navigation.push('/play/fun/entertainment-street?spawn=1540,580');

  const { t } = useTranslation('common');
  const { lobby, now, busy, error, pending, current, serverNow, refresh, submit } = usePetRace();
  const [selected, setSelected] = useState(0);
  const [stake, setStake] = useState('100');
  const [panel, setPanel] = useState<'bet' | 'result'>();
  const [resultView, setResultView] = useState<{ round: RaceRound; result?: RaceResult }>();
  const [celebration, setCelebration] = useState<string>();
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(undefined), 4500);
    return () => clearTimeout(timer);
  }, [celebration]);
  const seenResult = useRef<string | undefined>(undefined);
  const snapshotSeen = useRef(false);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const renderSize = useRef({ width: 1000, height: 560 });
  const activeRenderer = useRef<CharacterRenderer | undefined>(undefined);
  useEffect(() => {
    const element = viewport.current!;

    const resize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      renderSize.current = { width, height };
      activeRenderer.current?.resize(width, height, 1);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  const selection = useRef(selected);
  selection.current = selected;
  const phase = lobby ? racePhase(lobby.round, now) : undefined;
  const roundId = lobby?.round.id;
  useEffect(() => {
    if (phase && roundId) setPanel((value) => (value === 'bet' && phase !== 'betting' ? undefined : value));
  }, [phase, roundId]);
  useEffect(() => {
    if (!lobby) return;
    const firstSnapshot = !snapshotSeen.current;
    snapshotSeen.current = true;
    const settled = lobby.lastRace;
    if (!settled || seenResult.current === settled.requestId) return;
    seenResult.current = settled.requestId;
    if (firstSnapshot && settled.roundId !== lobby.round.id) return;
    setResultView({ round: lobby.round, result: settled });
    setPanel('result');
    if (settled.pet === settled.winner && (!firstSnapshot || settled.roundId === lobby.round.id)) {
      setCelebration(settled.requestId);
      audio.play('success');
    }
  }, [lobby, audio]);
  const bet = lobby?.bet;
  useEffect(() => {
    if (bet) {
      setSelected(bet.pet);
      setStake(String(bet.stake));
    }
  }, [bet]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneVersion explicitly retries asset/provider loading.
  useEffect(() => {
    let disposed = false;
    let renderer: CharacterRenderer | undefined;
    let releaseAssets: (() => void) | undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReady(false);
    setSceneError(false);
    void createPreviewProviders('phaser')
      .then(async (providers) => {
        if (disposed) return;
        const scene = await createRaceView();
        if (disposed) {
          scene.release();
          return;
        }
        releaseAssets = scene.release;
        renderer = providers.create('phaser', {
          parent: host.current!,
          width: renderSize.current.width,
          height: renderSize.current.height,
          zoom: 1,
          fillParent: true,
          backgroundColor: '#3eaaee',

          onReady: () => {
            if (!disposed) setReady(true);
          },

          onFrame(view, time) {
            const data = current.current;
            const instant = serverNow();
            const round = data?.round;
            const elapsed = round ? instant - round.startsAt - RACE_COUNTDOWN : 0;
            const run =
              round && instant >= round.startsAt && instant < round.nextRoundAt && round.finishTimes
                ? { finishTimes: round.finishTimes }
                : undefined;
            scene.draw(
              view,
              time,
              renderSize.current,
              run,
              elapsed,
              reduced.matches,
              data?.bet?.pet ?? selection.current,
            );
          },
        });
        activeRenderer.current = renderer;
      })
      .catch(() => {
        releaseAssets?.();
        releaseAssets = undefined;
        if (!disposed) setSceneError(true);
      });
    return () => {
      disposed = true;
      if (activeRenderer.current === renderer) activeRenderer.current = undefined;
      renderer?.destroy();
      releaseAssets?.();
    };
  }, [sceneVersion, current, serverNow]);

  const status = !lobby
    ? t('petRace.loading')
    : phase === 'betting'
      ? t('petRace.bettingCountdown', { count: Math.max(0, Math.ceil((lobby.round.startsAt - now) / 1000)) })
      : phase === 'countdown'
        ? t('petRace.countdown', {
            count: Math.max(0, Math.ceil((lobby.round.startsAt + RACE_COUNTDOWN - now) / 1000)),
          })
        : phase === 'racing'
          ? t('petRace.running')
          : t('petRace.nextRoundCountdown', { count: Math.max(0, Math.ceil((lobby.round.nextRoundAt - now) / 1000)) });
  return (
    <LocationLayout title={t('petRace.title')} player={player} coins={lobby?.coins} gems={gems} audio={audio}>
      <div className="pet-race-page">
        <section className="pet-race-screen">
          <div className="pet-race-content" data-receipts={!!(lobby?.bet || lobby?.lastRace)}>
            <div className="pet-race-viewport" ref={viewport}>
              <div className="pet-race-stage">
                <div className="pet-race-canvas" ref={host} role="img" aria-label={t('petRace.trackLabel')} />
                {phase === 'countdown' && (
                  <div className="pet-race-countdown" aria-hidden="true">
                    {Math.max(1, Math.ceil((lobby!.round.startsAt + RACE_COUNTDOWN - now) / 1000))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <section className="pet-race-dock" aria-label={t('petRace.controls')}>
            {lobby && (bet || lobby.lastRace) && (
              <div className="pet-race-receipts">
                {bet && <RaceBetSummary bet={bet} odds={lobby.round.odds[bet.pet]} />}
                {lobby.lastRace && (
                  <section className="pet-race-last-receipt" aria-label={t('petRace.lastResult')}>
                    <div className="pet-race-receipt-heading">
                      <strong>{t('petRace.lastResult')}</strong>
                      <Button
                        onClick={() => {
                          setCelebration(undefined);
                          setCelebration(undefined);
                          setResultView({ round: lobby.round, result: lobby.lastRace });
                          setPanel('result');
                        }}
                      >
                        {t('petRace.resultDetails')}
                      </Button>
                    </div>
                    <RaceSettlementSummary result={lobby.lastRace} />
                  </section>
                )}
              </div>
            )}
            {(error || sceneError) && (
              <div className="pet-race-error" role="alert">
                {t(
                  sceneError
                    ? 'petRace.sceneError'
                    : error === 'INSUFFICIENT_COINS'
                      ? 'petRace.insufficient'
                      : error === 'MATCH_IN_PROGRESS'
                        ? 'petRace.bettingClosed'
                        : 'petRace.betError',
                )}
                <Button
                  onClick={() => {
                    if (sceneError) setSceneVersion((value) => value + 1);
                    else void refresh();
                  }}
                >
                  {t('retry')}
                </Button>
              </div>
            )}
            <div className="pet-race-footer" data-phase={phase}>
              <Button onClick={onClose}>{t('petRace.back')}</Button>
              <span role="status" aria-live="polite">
                <small>
                  {t(
                    phase === 'betting'
                      ? 'petRace.phaseBetting'
                      : phase === 'results'
                        ? 'petRace.phaseResults'
                        : 'petRace.phaseRacing',
                  )}
                </small>
                <strong>{status}</strong>
              </span>
              {lobby && phase === 'results' && lobby.round.finishTimes ? (
                <Button
                  onClick={() => {
                    setCelebration(undefined);
                    setResultView({
                      round: lobby.round,
                      result: lobby.lastRace?.roundId === lobby.round.id ? lobby.lastRace : undefined,
                    });
                    setPanel('result');
                  }}
                >
                  {t('petRace.results')}
                </Button>
              ) : (
                <Button variant="primary" disabled={!lobby || phase !== 'betting'} onClick={() => setPanel('bet')}>
                  {t(lobby?.bet ? 'petRace.betDetails' : 'petRace.openBet')}
                </Button>
              )}
            </div>
          </section>
        </section>
      </div>
      {lobby && panel === 'bet' && phase === 'betting' && (
        <RaceBetDialog
          lobby={lobby}
          now={now}
          selected={selected}
          onSelect={setSelected}
          stake={stake}
          onStake={setStake}
          busy={busy}
          pending={!!pending}
          ready={ready}
          onSubmit={() => {
            void submit(selected, Number(stake)).then((confirmed) => {
              if (confirmed) setPanel((value) => (value === 'bet' ? undefined : value));
            });
          }}
          onClose={() => setPanel(undefined)}
        />
      )}
      {panel === 'result' && resultView && (
        <RaceResultDialog
          {...resultView}
          celebrate={celebration === resultView.result?.requestId}
          now={now}
          onClose={() => {
            setCelebration(undefined);
            setPanel(undefined);
          }}
        />
      )}
    </LocationLayout>
  );
}
