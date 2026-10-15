import { ArcadeGameMount, ArcadeHostProvider } from '@chibi-town/arcade-games-react';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import { Button, UiImage } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk, getRealtime } from '@/application/api-sdk';
import { AuthContext } from '@/application/auth-context';
import { createGameUi } from '@/application/game-ui-handler';
import { arcadeUrls } from '@/assets/generated-assets';
import { arcadeCss } from '@/assets/generated-styles';
import { ArcadeAvatar } from './_components/arcade-avatar';
import { accountRequiredSdk } from './_utils/account-required-sdk';
import { arcadeGames } from './_utils/registered-games';
export const styles = arcadeCss;

export function Screen({
  audio,
  definition,
}: {
  audio: ReturnType<typeof createGameAudio>;
  definition?: MapDefinition;
}) {
  useEffect(() => {
    const ui = createGameUi(document.body, audio);
    return () => ui.destroy();
  }, [audio]);
  const { t } = useTranslation('common');
  const navigation = useRouter();
  const auth = useContext(AuthContext);
  const [accountRequired, setAccountRequired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState<{ title: string; label: string; value: number }[]>([]);
  const host = useMemo(
    () => ({
      sdk: accountRequiredSdk(getApiSdk(), () => setAccountRequired(true)),
      realtime: getRealtime(),
      assets: arcadeUrls,
      Avatar: ArcadeAvatar,

      navigate: (url: string) => navigation.push(url),
    }),
    [navigation],
  );
  const [player, setPlayer] = useState<LocationPlayer>();
  const [wallet, setWallet] = useState<{ coins: number; gems: number }>();
  const [selectedGame, setSelectedGame] = useState<string>();
  const [top, setTop] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refreshWallet = useCallback(async () => {
    const inventory = await getApiSdk().getInventory();
    setWallet({ coins: inventory.farm.coins, gems: inventory.farm.gems });
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload explicitly retries loading the catalog and wallet.
  useEffect(() => {
    let alive = true;
    void Promise.all([
      host.sdk.getPlayer(),
      host.sdk.getInventory(),
      Promise.all(
        arcadeGames.list().map(async (game) => {
          if (!game.summary) return null;
          try {
            return { title: game.title, ...(await game.summary(host.sdk)) };
          } catch {
            return null;
          }
        }),
      ),
    ])
      .then(([p, inventory, summaries]) => {
        if (!alive) return;
        setLoaded(true);
        setStats(summaries.filter((summary) => summary !== null));
        setPlayer(p);
        setWallet({ coins: inventory.farm.coins, gems: inventory.farm.gems });
        setError('');
      })
      .catch(() => {
        if (alive) setError(t('arcadeLoadFailed'));
      });
    return () => {
      alive = false;
    };
  }, [reload, t, host]);
  useEffect(
    () =>
      host.realtime?.subscribe((event) => {
        if (event.type === 'reconnected') setReload((n) => n + 1);
      }),
    [host],
  );
  const activeGame = selectedGame ? arcadeGames.get(selectedGame) : undefined;
  return (
    <ArcadeHostProvider host={host}>
      <LocationLayout title={t('arcadeTitle')} player={player} coins={wallet?.coins} gems={wallet?.gems} audio={audio}>
        <div
          className="arcade-stage"
          style={{
            backgroundImage: `radial-gradient(ellipse at 50% 25%, #31876130, #06322260), url(${arcadeUrls.felt})`,
          }}
          aria-hidden="true"
        />
        {accountRequired && (
          <div role="alert" className="arcade-error">
            <p>{t('accountRequired', { ns: 'auth' })}</p>
            <Button
              onClick={() => {
                setAccountRequired(false);
                auth.openAuth();
              }}
            >
              {t('registerNow', { ns: 'auth' })}
            </Button>
          </div>
        )}
        {activeGame && player && wallet ? (
          <ArcadeGameMount
            game={activeGame}
            player={player}
            coins={wallet.coins}
            audio={audio}
            refreshWallet={refreshWallet}
            back={() => {
              setSelectedGame(undefined);
              setReload((n) => n + 1);
            }}
          />
        ) : (
          <>
            <section className="arcade-main">
              {!loaded && (
                <section className="arcade-load">
                  <p role="status">{error || t('arcadeLoading')}</p>
                  {error && <Button onClick={() => setReload((n) => n + 1)}>{t('retry')}</Button>}
                </section>
              )}
              {loaded && !top && (
                <>
                  <UiImage className="arcade-banner" asset="arcade:banner" alt={t('arcadeCatalog')} loading="eager" />
                  <div className="arcade-games">
                    {arcadeGames.list().map((game) => {
                      const card =
                        arcadeUrls[game.card] ?? (/^(\/|https?:|data:)/.test(game.card) ? game.card : undefined);
                      return (
                        <button
                          key={game.id}
                          className="arcade-game-card"
                          type="button"
                          aria-label={game.title}
                          onClick={() => {
                            setSelectedGame(game.id);
                          }}
                        >
                          {card ? <UiImage src={card} alt="" /> : <strong>{game.title}</strong>}
                          <span className="arcade-card-status is-open">{t('arcadePlayNow')}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {loaded && top && (
                <section className="arcade-top">
                  <h2 className="arcade-ribbon">{t('arcadeTopTitle')}</h2>
                  {stats.map((stat) => (
                    <div className="arcade-best" key={stat.title}>
                      <span aria-hidden="true">🏆</span>
                      <strong>{t('arcadeStatOwner', { game: stat.title, name: player?.name ?? '' })}</strong>
                      <b>{t('arcadeStatValue', { label: stat.label, value: stat.value })}</b>
                    </div>
                  ))}
                  <p>{t('arcadeTopIntro')}</p>
                </section>
              )}
            </section>
            <footer className="arcade-footer">
              <Button
                aria-label={t('arcadeBack')}
                onClick={() => {
                  if (top) setTop(false);
                  else {
                    const portal = definition?.portals[0];
                    navigation.push(
                      portal
                        ? `/play/${definition!.regionId}/${portal.target}?spawn=${portal.spawn.join(',')}`
                        : '/play/fun/entertainment-street',
                    );
                  }
                }}
              >
                <span aria-hidden="true">❮</span>
                <span>{t(top ? 'arcadeCatalog' : 'arcadeBackStreet')}</span>
              </Button>
              <div className="arcade-footer-actions">
                {!top && (
                  <Button disabled={!loaded} onClick={() => setTop(true)}>
                    {t('arcadeTop')}
                  </Button>
                )}
              </div>
            </footer>
          </>
        )}
      </LocationLayout>
    </ArcadeHostProvider>
  );
}
