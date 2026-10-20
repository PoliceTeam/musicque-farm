'use client';
import { createGameAudio } from '@chibi-town/game-audio';
import { type MapDefinition, validateWorld } from '@chibi-town/game-content';
import { ImageProvider } from '@chibi-town/ui/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { AppImage } from '@/application/_components/app-image';
import { locationMusic } from '@/application/_utils/location-music';
import { getApiSdk } from '@/application/api-sdk';
import type { AuthPlayer } from '@/application/auth-client';
import { AUTH_REQUIRED_EVENT, getAuthClient } from '@/application/auth-client';
import { AuthContext, shouldShowGuestPrompt } from '@/application/auth-context';
import { createGameI18n, refreshGameI18nResources } from '@/application/i18n/instance';
import { gameRoute } from '@/application/screen-router';
import { registeredImageAssets } from '@/assets/generated-assets';
import { authCss, themeCss } from '@/assets/generated-styles';
import { AuthDialog } from '@/features/auth/auth-dialog';
import { PublicChat } from '@/features/chat/_components/public-chat';
import { chatAreaForScreen } from '@/features/chat/_utils/chat-area';

type Audio = ReturnType<typeof createGameAudio>;
type ScreenModule = {
  styles: string;
  Screen: ComponentType<{ audio: Audio; definition?: MapDefinition; backgroundOnly?: boolean }>;
};
const loaders: Record<string, () => Promise<ScreenModule>> = {
  '/map': () => import('@/features/world-map/main'),

  '/farm': () => import('@/features/farm-entrance/main'),

  '/farm/home': () =>
    process.env.NODE_ENV === 'development'
      ? import('@/devtools/farm-art-review/farm-review-screen')
      : import('@/features/farm/main'),

  '/arcade': () => import('@/features/arcade/main'),

  '/location': () => import('@/features/location/main'),

  '/pet-racing': () => import('@/features/pet-racing/main'),

  ...(process.env.NODE_ENV !== 'production'
    ? {
        '/character': () => import('@/devtools/character/screen'),

        '/farm-art-review': () => import('@/devtools/farm-art-review/art-review-screen'),

        '/ui': () => import('@/devtools/ui/showcase'),

        '/town': () => import('@/devtools/town/screen'),
      }
    : {}),
};

function resolveRoute(path: string) {
  const route = gameRoute(path === '/' ? '/map' : path);
  if (route && route in loaders) return route;
  const parts = path.split('/');
  if (parts[1] === 'play' && parts.length === 4 && parts[2] && parts[3]) return '/location';
  return undefined;
}

/** Persistent React shell owns SDK/runtime services; screens remain in the Next React tree. */
export function GameApplication() {
  const [i18n] = useState(() => createGameI18n());
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') refreshGameI18nResources(i18n);
  }, [i18n]);
  return (
    <I18nextProvider i18n={i18n}>
      <ImageProvider assets={registeredImageAssets} Image={AppImage}>
        <GameApplicationContent />
      </ImageProvider>
    </I18nextProvider>
  );
}

function GameApplicationContent() {
  const { t } = useTranslation('common');
  const translate = useRef(t);
  translate.current = t;
  const pathname = usePathname();
  const navigation = useRouter();
  const search = useSearchParams().toString();
  const [audio, setAudio] = useState<Audio>();
  const [screen, setScreen] = useState<{
    module: ScreenModule;
    path: string;
    definition?: MapDefinition;
    backgroundOnly?: boolean;
  }>();
  const [error, setError] = useState('');
  /** Without a server there is no account, so the local adapter starts signed in. */
  const [auth, setAuth] = useState<{
    status: 'checking' | 'signed-in' | 'signed-out';
    google: boolean;
    player?: AuthPlayer;
  }>(() => ({
    status: getAuthClient() ? 'checking' : 'signed-in',
    google: false,
  }));
  const [authOpen, setAuthOpen] = useState(false);
  const [entryRequest] = useState(() => ({ pathname, search }));
  useEffect(() => {
    const client = getAuthClient();
    if (!client) return;
    let disposed = false;
    void client[entryRequest.pathname === '/' ? 'session' : 'start']()
      .then(
        ({ player, providers }) => {
          const current = player;
          if (disposed) return;
          if (!current) {
            setAuth({ status: 'signed-out', google: providers.google });
            return;
          }

          setAuth({ status: 'signed-in', google: providers.google, player: current });
          if (
            !current.guest &&
            (current.username === null ||
              current.characterSetupRequired ||
              new URLSearchParams(entryRequest.search).get('auth') === 'registered')
          )
            setAuthOpen(true);
          if (current.guest) {
            const show = shouldShowGuestPrompt(() => window.sessionStorage);
            setAuthOpen(show || new URLSearchParams(entryRequest.search).get('auth') === 'failed');
          }
        },
        () => {
          if (!disposed) setError(translate.current('locationLoadFailed'));
        },
      )
      .catch(() => {
        if (!disposed) setError(translate.current('locationLoadFailed'));
      });

    /** Reloading drops cached snapshots before a fresh session is established. */
    const expired = () => window.location.reload();

    window.addEventListener(AUTH_REQUIRED_EVENT, expired);
    return () => {
      disposed = true;
      window.removeEventListener(AUTH_REQUIRED_EVENT, expired);
    };
  }, [entryRequest]);
  const screenStyle = useRef<HTMLStyleElement>(undefined);
  useEffect(() => {
    const style = document.createElement('style');
    const sharedStyle = document.createElement('style');
    sharedStyle.textContent = themeCss + '\n' + authCss;
    document.head.append(style, sharedStyle);
    screenStyle.current = style;
    const service = createGameAudio({
      musicUrl: '/chibi-assets/map/audio/chibi-town-loop.mp3',
      loopSeconds: 76.8,
      musicEnabled: false,

      onState() {},
    });
    setAudio(service);

    const unlock = () => void service.unlock();

    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      const route = url.origin === location.origin ? resolveRoute(url.pathname) : undefined;
      if (!route) return;
      event.preventDefault();
      navigation.push(`${url.pathname.endsWith('.html') ? route : url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', navigate);
    return () => {
      service.destroy();
      screenStyle.current = undefined;
      style.remove();
      sharedStyle.remove();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', navigate);
    };
  }, [navigation]);
  const canLoadScreen = pathname === '/' || auth.status === 'signed-in';
  useEffect(() => {
    if (!canLoadScreen) {
      setScreen(undefined);
      return;
    }
    let disposed = false;
    const route = resolveRoute(pathname);
    setError('');
    if (!route) {
      setScreen(undefined);
      setError(translate.current('locationClosed'));
      return;
    }

    const load = async () => {
      let definition: MapDefinition | undefined;
      let renderer = route;
      if (route === '/location') {
        const world = await getApiSdk().getWorld();
        validateWorld(world);
        const [, , regionId, mapId] = pathname.split('/');
        definition = world.maps.find((map) => map.regionId === regionId && map.id === mapId);
        if (!definition) throw new Error('Map not found');
        const spawn = new URLSearchParams(search).get('spawn')?.split(',').map(Number);
        if (
          spawn &&
          spawn.length === 2 &&
          spawn.every(Number.isFinite) &&
          spawn[0] >= 0 &&
          spawn[1] >= 0 &&
          spawn[0] <= definition.width &&
          spawn[1] <= definition.height
        )
          definition = { ...definition, spawn: [spawn[0], spawn[1]] };
        renderer = definition.scene === 'farm' ? '/farm' : definition.scene === 'arcade' ? '/arcade' : '/location';
      }
      if (renderer === '/farm' && process.env.NODE_ENV !== 'production' && new URLSearchParams(search).has('review'))
        renderer = '/farm/home';
      return { module: await loaders[renderer](), definition };
    };

    void load()
      .then(({ module, definition }) => {
        if (disposed) return;
        if (screenStyle.current) screenStyle.current.textContent = module.styles;
        window.scrollTo(0, 0);
        setScreen({ module, path: `${pathname}?${search}`, definition });
      })
      .catch(() => {
        if (!disposed) setError(translate.current('locationLoadFailed'));
      });
    return () => {
      disposed = true;
    };
  }, [pathname, search, canLoadScreen]);
  useEffect(() => {
    if (screen) audio?.setMusic(locationMusic(resolveRoute(screen.path.split('?')[0]) ?? '/map', screen.definition));
  }, [audio, screen]);
  const Screen = screen?.module.Screen;
  const chatArea = screen ? chatAreaForScreen(screen.path, screen.definition) : undefined;
  const authClient = getAuthClient();
  const entry = pathname === '/' && !!authClient && auth.status !== 'signed-in';
  return (
    <AuthContext.Provider
      value={{
        player: auth.player,

        openAuth: () => setAuthOpen(true),
      }}
    >
      <div
        id="app"
        data-route={entry ? '/login' : resolveRoute(pathname)}
        style={
          entry ? { minHeight: '100dvh', background: 'radial-gradient(ellipse at top, #327b58, #0e3e32)' } : undefined
        }
      >
        {((entry && auth.status !== 'checking') ||
          authOpen ||
          (auth.player &&
            !auth.player.guest &&
            (auth.player.username === null || auth.player.characterSetupRequired))) &&
          authClient && (
            <AuthDialog
              client={authClient}
              entry={entry}
              onContinueGuest={
                entry
                  ? async () => {
                      const player = auth.player ?? (await authClient.guest());
                      shouldShowGuestPrompt(() => window.sessionStorage);
                      setAuthOpen(false);
                      setAuth({ status: 'signed-in', player, google: auth.google });
                      navigation.replace('/');
                    }
                  : undefined
              }
              google={auth.google}
              confirmationPlayer={auth.player}
              usernameRequired={!!auth.player && !auth.player.guest && auth.player.username === null}
              registrationBonus={new URLSearchParams(search).get('auth') === 'registered'}
              googleFailed={new URLSearchParams(search).get('auth') === 'failed'}
              onClose={() => setAuthOpen(false)}
              onSignedIn={() => {
                if (entry) {
                  window.location.assign('/');
                  return;
                }
                const url = new URL(window.location.href);
                url.searchParams.delete('auth');
                window.location.assign(url.href);
              }}
            />
          )}
        {error ? (
          <div role="alert">
            {error}{' '}
            <button type="button" onClick={() => navigation.push('/')}>
              {t('backToMap')}
            </button>
          </div>
        ) : Screen && audio ? (
          <Screen
            key={screen.path}
            audio={audio}
            definition={screen.definition}
            backgroundOnly={
              auth.status !== 'signed-in' ||
              !!auth.player?.characterSetupRequired ||
              (!!auth.player && !auth.player.guest && auth.player.username === null)
            }
          />
        ) : (
          <p role="status">{auth.status === 'checking' ? t('checking', { ns: 'auth' }) : t('loadingLocation')}</p>
        )}
        {chatArea &&
          Screen &&
          audio &&
          !error &&
          !entry &&
          !authOpen &&
          auth.status === 'signed-in' &&
          !auth.player?.characterSetupRequired &&
          (!auth.player || auth.player.guest || auth.player.username !== null) && (
            <PublicChat key={`${chatArea.regionId}/${chatArea.mapId}`} area={chatArea} playerId={auth.player?.id} />
          )}
      </div>
    </AuthContext.Provider>
  );
}
