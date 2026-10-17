import type { FriendList } from '@chibi-town/contracts/social';
import { useEffect, useState } from 'react';
import { getRealtime } from '@/application/api-sdk';
import { newFriendNotice, type SocialNotice } from '@/features/social/_utils/friend-notifications';
import { socialClient } from '@/features/social/social-client';
import { SOCIAL_ACTION_EVENT, type SocialActionDetail } from '@/features/social/social-events';

// Preserve the notification baseline across map navigation, but always reload from the server.
const snapshots = new Map<string, FriendList>();

export function useFriendInbox(playerId?: string) {
  const [incoming, setIncoming] = useState(0);
  const [notice, setNotice] = useState<SocialNotice>();
  useEffect(() => {
    if (!playerId || !process.env.NEXT_PUBLIC_API_URL) return;
    let active = true;
    let version = 0;
    setNotice(undefined);
    setIncoming(snapshots.get(playerId)?.entries.filter((entry) => entry.state === 'incoming').length ?? 0);

    const reload = () => {
      const current = ++version;
      void socialClient
        .list()
        .then((list) => {
          if (!active || current !== version) return;
          setIncoming(list.entries.filter((entry) => entry.state === 'incoming').length);
          const update = newFriendNotice(snapshots.get(playerId), list);
          snapshots.set(playerId, list);
          if (update) setNotice(update);
        })
        .catch(() => {});
    };

    const completed = (event: Event) => {
      const detail = (event as CustomEvent<SocialActionDetail>).detail;
      setNotice({ kind: 'action', ...detail });
      reload();
    };

    window.addEventListener(SOCIAL_ACTION_EVENT, completed);
    const realtime = getRealtime();
    const off = realtime?.subscribe((event) => {
      if (event.type === 'social.changed' || event.type === 'reconnected') reload();
    });
    realtime?.send({ type: 'social.watch' });
    reload();
    return () => {
      active = false;
      off?.();
      window.removeEventListener(SOCIAL_ACTION_EVENT, completed);
    };
  }, [playerId]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(undefined), 8000);
    return () => clearTimeout(timeout);
  }, [notice]);
  return {
    incoming,
    notice,

    dismissNotice: () => setNotice(undefined),
  };
}
