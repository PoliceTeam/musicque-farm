import type { ChannelDirectory } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk } from '@/application/api-sdk';
import { locationCss } from '@/assets/generated-styles';
import { ChannelDialog } from '@/features/location/_components/channel-dialog';
import type { Attraction } from '@/features/location/_utils/location-input-logic';
import { navigateLocationPortal } from '@/features/location/location-navigation-handler';
import { createLocationGame } from '@/features/location/runtime/location-game';

export const styles = locationCss;

export function Screen({
  definition,
  audio,
}: {
  audio: ReturnType<typeof createGameAudio>;
  definition?: MapDefinition;
}) {
  const { t } = useTranslation('common');
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
  const updateChannels = useCallback((directory: ChannelDirectory) => {
    channelVersion.current++;
    channelRef.current = directory;
    setChannelDirectory(directory);
  }, []);
  const [attraction, setAttraction] = useState<Attraction>();
  const host = useRef<HTMLDivElement>(null);
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
    return createLocationGame({
      parent: host.current!,
      map: definition,

      labels: () => labels.current,

      channel: () => channelRef.current,

      onHeader: setHeader,

      onChannels: () => setChannelDialog(true),

      onAttraction: (value) => {
        if (value === 'racing') navigation.push('/play/fun/pet-racing');
        else setAttraction(value);
      },

      navigate: navigation.push,

      onError: () => setError(labels.current('locationLoadFailed')),
    });
  }, [definition, navigation.push]);
  return (
    <LocationLayout
      title={definition?.label ?? t('locationLabel')}
      player={header?.player}
      coins={header?.coins}
      gems={header?.gems}
      audio={audio}
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
      <div className="location-canvas" ref={host} />
      <nav className="location-portals" aria-label={t('locationLabel')}>
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
              {t('locationPortal', { name: portalLabels[portal.target] ?? t('visitDestination') })}
            </Button>
          ))}
        {error && <p role="alert">{error}</p>}
      </nav>
      {definition?.regionId === 'fun' && (
        <details className="location-hint">
          <summary>{t('locationControls')}</summary>
          <p>{t('entertainmentHint')}</p>
        </details>
      )}
      {channelDialog && definition?.channels && (
        <ChannelDialog
          map={{ regionId: definition.regionId, mapId: definition.id }}
          onChanged={updateChannels}
          onClose={() => setChannelDialog(false)}
        />
      )}
      {attraction && attraction !== 'racing' && (
        <Dialog title={t(`attractions.${attraction}`)} onClose={() => setAttraction(undefined)} closeLabel={t('close')}>
          <p>{t('entertainmentPreview')}</p>
        </Dialog>
      )}
    </LocationLayout>
  );
}
