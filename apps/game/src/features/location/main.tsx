import type { Outfit } from '@chibi-town/character-core/character-types';
import type { ChannelDirectory } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition, MapLayer } from '@chibi-town/game-content';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from '@/application/_components/loading-overlay';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk } from '@/application/api-sdk';
import { locationCss } from '@/assets/generated-styles/location-css';
import { ChannelDialog } from '@/features/location/_components/channel-dialog';
import type { Attraction } from '@/features/location/_utils/location-input-logic';
import { navigateLocationPortal } from '@/features/location/location-navigation-handler';
import { createLocationGame } from '@/features/location/runtime/location-game';
import { PlayerInteractionDialog } from '@/features/social/_components/player-interaction-dialog';
import { PlayerRadialMenu } from '@/features/social/_components/player-radial-menu';

const ShopDialog = lazy(() =>
  import('@/features/shop/_components/shop-dialog').then((module) => ({ default: module.ShopDialog })),
);

const LuckyDrawDialog = lazy(() =>
  import('@/features/lucky-draw/_components/lucky-draw-dialog').then((module) => ({ default: module.LuckyDrawDialog })),
);

const JewelerDialog = lazy(() =>
  import('@/features/jeweler/_components/jeweler-dialog').then((module) => ({ default: module.JewelerDialog })),
);

export const styles = locationCss;

export function Screen({
  definition,
  audio,
}: {
  audio: ReturnType<typeof createGameAudio>;
  definition?: MapDefinition;
}) {
  const { t } = useTranslation('common');
  const { t: jewelerText } = useTranslation('jeweler');
  const labels = useRef(t);
  labels.current = t;
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const channelRef = useRef<ChannelDirectory | undefined>(undefined);
  const channelVersion = useRef(0);
  const [channelDirectory, setChannelDirectory] = useState<ChannelDirectory>();
  const [channelDialog, setChannelDialog] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; point: [number, number] }>();
  const selectedId = useRef<string | undefined>(undefined);
  const radial = useRef<HTMLDivElement>(null);
  const [profileId, setProfileId] = useState<string>();
  const closeRadial = useCallback(() => {
    selectedId.current = undefined;
    setSelectedPlayer(undefined);
  }, []);
  const updateChannels = useCallback((directory: ChannelDirectory) => {
    channelVersion.current++;
    channelRef.current = directory;
    setChannelDirectory(directory);
  }, []);
  const [shop, setShop] = useState<MapLayer['shop']>();
  const [jeweler, setJeweler] = useState(false);
  const [attraction, setAttraction] = useState<Attraction>();
  const host = useRef<HTMLDivElement>(null);
  const equippedOutfit = useRef<Outfit | undefined>(undefined);
  const navigation = useRouter();
  const [portalLabels, setPortalLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    let disposed = false;
    setPortalLabels({});
    if (definition?.portals.some((portal) => portal.target !== 'world'))
      void getApiSdk()
        .getWorld()
        .then((world) => {
          if (!disposed) setPortalLabels(Object.fromEntries(world.maps.map((map) => [map.id, map.label])));
        })
        .catch(() => {
          if (!disposed) setError(labels.current('locationLoadFailed'));
        });
    return () => {
      disposed = true;
    };
  }, [definition]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [header, setHeader] = useState<{ player: LocationPlayer; coins: number; gems: number }>();
  useEffect(() => {
    channelRef.current = undefined;
    setChannelDirectory(undefined);
    if (!definition?.channels) return;
    let disposed = false;
    const version = channelVersion.current;
    void getApiSdk()
      .getMapChannels({ regionId: definition.regionId, mapId: definition.id })
      .then((data) => {
        if (!disposed && channelVersion.current === version) updateChannels(data);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [definition, updateChannels]);
  useEffect(() => {
    if (!definition) return;
    setReady(false);
    return createLocationGame({
      parent: host.current!,
      map: definition,

      labels: () => labels.current,

      channel: () => channelRef.current,

      onHeader: setHeader,

      onReady: () => setReady(true),

      onPlayer: (id, point) => {
        if (!point) return;
        selectedId.current = id;
        setSelectedPlayer({ id, point });
      },

      selectedPlayer: () => selectedId.current,

      onPlayerPosition: (point) => {
        if (!point) {
          closeRadial();
          return;
        }
        if (radial.current) {
          radial.current.style.left = `${point[0]}px`;
          radial.current.style.top = `${point[1]}px`;
          radial.current.dataset.edge = point[0] < 180 ? 'left' : point[0] > window.innerWidth - 180 ? 'right' : '';
          radial.current.dataset.bottom = String(point[1] > window.innerHeight - 180);
        }
      },

      outfit: () => equippedOutfit.current,

      onChannels: () => setChannelDialog(true),

      onShop: (value) => (value === 'jewelry' ? setJeweler(true) : setShop(value)),

      onAttraction: (value) => {
        if (value === 'racing') navigation.push('/play/fun/pet-racing');
        else setAttraction(value);
      },

      navigate: navigation.push,

      onError: () => setError(labels.current('locationLoadFailed')),
    });
  }, [definition, navigation.push, closeRadial]);
  return (
    <LocationLayout
      title={definition?.label ?? t('locationLabel')}
      player={header?.player}
      coins={header?.coins}
      gems={header?.gems}
      audio={audio}
      onOutfitChange={(next) => {
        equippedOutfit.current = next;
        setHeader((value) => value && { ...value, player: { ...value.player, outfit: next } });
      }}
      menuActions={
        definition?.channels && (
          <Button onClick={() => setChannelDialog(true)}>
            <span>{t('channelsTitle')}</span>
            <span className="ui-menu-value">
              {t('channelNumber', { id: channelDirectory?.currentChannelId ?? '…' })}
            </span>
          </Button>
        )
      }
    >
      {shop === 'jewelry' && (
        <Dialog title={t('jewelryTitle')} closeLabel={t('close')} onClose={() => setShop(undefined)}>
          <p>{t('jewelryPreparing')}</p>
        </Dialog>
      )}
      {shop && shop !== 'jewelry' && (
        <Suspense fallback={null}>
          <ShopDialog
            shop={shop}
            onClose={() => setShop(undefined)}
            onChanged={(page) => {
              equippedOutfit.current = page.outfit;
              setHeader(
                (value) =>
                  value && { player: { ...value.player, outfit: page.outfit }, coins: page.coins, gems: page.gems },
              );
            }}
          />
        </Suspense>
      )}
      {selectedPlayer && (
        <PlayerRadialMenu
          key={selectedPlayer.id}
          id={selectedPlayer.id}
          anchor={selectedPlayer.point}
          menuRef={radial}
          onClose={closeRadial}
          onInformation={() => {
            setProfileId(selectedPlayer.id);
            closeRadial();
          }}
        />
      )}
      {profileId && <PlayerInteractionDialog id={profileId} onClose={() => setProfileId(undefined)} />}
      <div className="location-canvas" ref={host} />
      <nav
        className={`location-portals${definition?.presentation === 'interior' ? ' is-interior' : ''}`}
        aria-label={t('locationLabel')}
      >
        {definition?.portals
          .filter((portal) => portal.target !== 'world')
          .map((portal) => (
            <Button
              key={portal.id}
              onClick={() =>
                void navigateLocationPortal(portal, {
                  getWorld: () => getApiSdk().getWorld(),

                  isActive: () => alive.current,

                  navigate: navigation.push,

                  onError: () => setError(labels.current('locationLoadFailed')),
                })
              }
            >
              {t(definition.presentation === 'interior' ? 'returnLocation' : 'locationPortal', {
                name: portalLabels[portal.target] ?? t('visitDestination'),
              })}
            </Button>
          ))}
        {!ready && !error && <LoadingOverlay label={t('loadingLocation')} />}
        {error && <p role="alert">{error}</p>}
      </nav>
      {definition?.layers?.some((layer) => layer.shop) && (
        <Button
          className="location-controls-toggle"
          onClick={() => {
            const role = definition.layers?.find((layer) => layer.shop)?.shop;
            if (role === 'jewelry') setJeweler(true);
            else setShop(role);
          }}
        >
          {definition.layers.some((layer) => layer.shop === 'jewelry') ? jewelerText('title') : t('shopEmployee')}
        </Button>
      )}
      {definition?.regionId === 'fun' && (
        <Button className="location-controls-toggle" onClick={() => setControlsOpen(true)}>
          {t('locationControls')}
        </Button>
      )}
      {controlsOpen && (
        <Dialog title={t('locationControls')} closeLabel={t('close')} onClose={() => setControlsOpen(false)}>
          <p>{t('entertainmentHint')}</p>
        </Dialog>
      )}
      {channelDialog && definition?.channels && (
        <ChannelDialog
          map={{ regionId: definition.regionId, mapId: definition.id }}
          onChanged={updateChannels}
          onClose={() => setChannelDialog(false)}
        />
      )}
      {jeweler && (
        <Suspense fallback={null}>
          <JewelerDialog
            onClose={() => setJeweler(false)}
            onChanged={() => {
              void Promise.all([getApiSdk().getPlayer(), getApiSdk().getInventory()])
                .then(([player, inventory]) => {
                  if (alive.current) {
                    setHeader({ player, coins: inventory.farm.coins, gems: inventory.farm.gems });
                    equippedOutfit.current = player.outfit;
                  }
                })
                .catch(() => {});
            }}
          />
        </Suspense>
      )}
      {attraction === 'prizes' && (
        <Suspense fallback={null}>
          <LuckyDrawDialog
            onClose={() => setAttraction(undefined)}
            onChanged={(data) => setHeader((value) => value && { ...value, coins: data.coins, gems: data.gems })}
          />
        </Suspense>
      )}
      {attraction && attraction !== 'racing' && attraction !== 'prizes' && (
        <Dialog title={t(`attractions.${attraction}`)} onClose={() => setAttraction(undefined)} closeLabel={t('close')}>
          <p>{t('entertainmentPreview')}</p>
        </Dialog>
      )}
    </LocationLayout>
  );
}
