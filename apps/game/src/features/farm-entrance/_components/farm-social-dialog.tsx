import type { FarmTheftEntry } from '@chibi-town/contracts/farm-social';
import type { FriendEntry } from '@chibi-town/contracts/social';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { SocialAvatar } from '@/features/social/_components/social-avatar';
import { socialClient } from '@/features/social/social-client';

export function FarmSocialDialog({ mode, onClose }: { mode: 'friends' | 'history'; onClose(): void }) {
  const { t, i18n } = useTranslation('farm');
  const { t: common } = useTranslation('common');
  const navigation = useRouter();
  const [friends, setFriends] = useState<FriendEntry[]>();
  const [history, setHistory] = useState<FarmTheftEntry[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing attempt explicitly retries a failed load.
  useEffect(() => {
    let disposed = false;
    setError(false);
    if (mode === 'friends' && !process.env.NEXT_PUBLIC_API_URL) {
      setFriends([]);
      return;
    }

    const load = async () => {
      if (mode === 'friends') {
        const list = await socialClient.list();
        if (!disposed) setFriends(list.entries.filter((entry) => entry.state === 'friends'));
      } else {
        const entries = await getApiSdk().getFarmTheftHistory();
        if (!disposed) setHistory(entries);
      }
    };

    void load().catch(() => {
      if (!disposed) setError(true);
    });
    return () => {
      disposed = true;
    };
  }, [mode, attempt]);
  const loading = !error && (mode === 'friends' ? !friends : !history);
  return (
    <Dialog
      className="farm-entrance-dialog"
      title={t(mode === 'friends' ? 'visitFriends' : 'theftHistory')}
      closeLabel={common('close')}
      onClose={onClose}
    >
      {error ? (
        <p role="alert">
          {t('socialLoadFailed')} <Button onClick={() => setAttempt((value) => value + 1)}>{common('retry')}</Button>
        </p>
      ) : loading ? (
        <p role="status">{common('loadingLocation')}</p>
      ) : mode === 'friends' ? (
        <>
          <p>{t('visitHint')}</p>
          {!friends?.length && <p>{t(process.env.NEXT_PUBLIC_API_URL ? 'noFriendFarms' : 'onlineFriendsRequired')}</p>}
          <ul className="farm-social-list">
            {friends?.map(({ player }) => (
              <li key={player.id}>
                <SocialAvatar outfit={player.outfit} name={player.name} />
                <strong>{player.name}</strong>
                <Button
                  variant="primary"
                  onClick={() => navigation.push(`/farm/home?owner=${encodeURIComponent(player.id)}`)}
                >
                  {t('visitFarm')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {!history?.length && <p>{t('noTheftHistory')}</p>}
          <ul className="farm-social-list">
            {history?.map((entry) => (
              <li key={`${entry.at}:${entry.visitorId}:${entry.index}`}>
                <div>
                  <strong>
                    {t('theftEntry', {
                      name: entry.visitorName,
                      product: t(`products.${entry.cropId}`, { ns: 'inventory' }),
                      plot: entry.index + 1,
                    })}
                  </strong>
                  <small>{new Date(entry.at).toLocaleString(i18n.language)}</small>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
