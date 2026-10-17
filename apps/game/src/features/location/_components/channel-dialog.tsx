import type { ChannelDirectory, MapChannelInput } from '@chibi-town/contracts';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';

export function ChannelDialog({
  map,
  onChanged,
  onClose,
}: {
  map: MapChannelInput;
  onChanged: (directory: ChannelDirectory) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const [directory, setDirectory] = useState<ChannelDirectory>();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number>();
  const [error, setError] = useState('');
  const [request, setRequest] = useState(() => ({ regionId: map.regionId, mapId: map.mapId }));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError('');
    void getApiSdk()
      .getMapChannels(request)
      .then((data) => {
        if (!disposed) {
          setDirectory(data);
          onChanged(data);
        }
      })
      .catch(() => {
        if (!disposed) setError(t('channelsLoadFailed'));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [request, t, onChanged]);

  async function join(channelId: number) {
    if (joining !== undefined) return;
    setJoining(channelId);
    setError('');
    try {
      const next = await getApiSdk().joinMapChannel({ ...map, channelId });
      onChanged(next);
      if (alive.current) onClose();
    } catch (failure) {
      if (alive.current)
        setError(
          t(failure instanceof Error && failure.message === 'CHANNEL_FULL' ? 'channelFullError' : 'channelJoinFailed'),
        );
    } finally {
      if (alive.current) setJoining(undefined);
    }
  }

  return (
    <Dialog
      title={t('channelsTitle')}
      onClose={onClose}
      closeLabel={t('close')}
      footer={
        <div className="channel-footer">
          <Button
            disabled={loading || joining !== undefined}
            onClick={() => setRequest({ regionId: map.regionId, mapId: map.mapId })}
          >
            {t('channelsRefresh')}
          </Button>
          <Button disabled={joining !== undefined} onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      {directory?.source === 'mock' && <p className="channel-mock-note">{t('channelsMock')}</p>}
      {loading && <p role="status">{t('channelsLoading')}</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset className="channel-list" aria-label={t('channelsTitle')} aria-busy={loading || joining !== undefined}>
        {directory?.channels.map((channel) => {
          const current = channel.id === directory.currentChannelId;
          const full = channel.occupants >= channel.capacity;
          return (
            <Button
              key={channel.id}
              className="channel-option"
              aria-pressed={current}
              disabled={current || full || loading || joining !== undefined}
              onClick={() => void join(channel.id)}
            >
              <strong>{t('channelNumber', { id: channel.id })}</strong>
              <span>{t('channelOccupancy', { count: channel.occupants, capacity: channel.capacity })}</span>
              <small>
                {joining === channel.id
                  ? t('channelJoining')
                  : current
                    ? t('channelCurrent')
                    : full
                      ? t('channelFull')
                      : t('channelAvailable')}
              </small>
            </Button>
          );
        })}
      </fieldset>
    </Dialog>
  );
}
