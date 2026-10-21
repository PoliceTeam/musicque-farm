import type { FriendAction, FriendList } from '@chibi-town/contracts/social';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRealtime } from '@/application/api-sdk';
import { socialCss } from '@/assets/generated-styles/social-css';
import { ChatContext } from '@/features/chat/chat-context';
import { FriendActions } from '@/features/social/_components/friend-actions';
import { InboxIcon } from '@/features/social/_components/inbox-button';
import { PlayerInteractionDialog } from '@/features/social/_components/player-interaction-dialog';
import { SocialAvatar } from '@/features/social/_components/social-avatar';
import { socialClient } from '@/features/social/social-client';
import { socialErrorMessage } from '@/features/social/social-error-message';

type Tab = 'friends' | 'incoming' | 'outgoing' | 'chat';

export function FriendsDialog({ onClose, initialTab = 'friends' }: { onClose(): void; initialTab?: Tab }) {
  const { t } = useTranslation('social');
  const chat = useContext(ChatContext);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<FriendList>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string>();
  const busy = useRef(false);
  useEffect(() => {
    const realtime = getRealtime();
    const off = realtime?.subscribe((event) => {
      if (event.type === 'social.changed' || event.type === 'reconnected') setRevision((n) => n + 1);
    });
    realtime?.send({ type: 'social.watch' });
    return off;
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads after commands or realtime invalidation.
  useEffect(() => {
    let active = true;
    setLoading(true);
    void socialClient
      .list()
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError(t('loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, t]);

  async function change(id: string, action: FriendAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await socialClient.change(id, action);
      setRevision((n) => n + 1);
    } catch (reason) {
      setError(socialErrorMessage(reason, t));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const rows = data?.entries.filter((entry) => entry.state === tab) ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  return (
    <>
      <Dialog
        title={t('messages')}
        hideTitle
        className="social-dialog social-friends-dialog"
        showCloseFooter={false}
        onClose={onClose}
        closeLabel={t('close', { ns: 'common' })}
        tabs={
          <Tabs
            appearance="folder"
            value={tab}
            onChange={(id) => {
              setTab(id as Tab);
              setPage(0);
            }}
            label={t('messages')}
            items={[
              ...(['friends', 'incoming', 'outgoing'] as const).map((id) => ({
                id,
                label: data?.entries.some((entry) => entry.state === id)
                  ? t('tabCount', {
                      label: t(`tabs.${id}`),
                      count: data.entries.filter((entry) => entry.state === id).length,
                    })
                  : t(`tabs.${id}`),
              })),
              ...(chat.area ? [{ id: 'chat', label: t('title', { ns: 'chat' }) }] : []),
            ]}
          />
        }
      >
        <style>{socialCss}</style>
        {tab === 'chat' && chat.area && <div ref={chat.setHost} />}
        {tab !== 'chat' && (
          <>
            {error && (
              <p role="alert">
                {error} <Button onClick={() => setRevision((n) => n + 1)}>{t('retry', { ns: 'common' })}</Button>
              </p>
            )}
            {loading && !data && <p role="status">{t('loading')}</p>}
            {!loading && !error && !rows.length && (
              <div className="social-empty">
                <span className="social-empty-icon">
                  <InboxIcon />
                </span>
                <strong>{t(`empty.${tab}`)}</strong>
                {tab === 'friends' && <p>{t('emptyHint')}</p>}
                {tab === 'friends' && !!data?.entries.some((entry) => entry.state === 'incoming') && (
                  <Button
                    onClick={() => {
                      setTab('incoming');
                      setPage(0);
                    }}
                  >
                    {t('viewInvitations')}
                  </Button>
                )}
              </div>
            )}
            <div className="social-list">
              {rows.slice(currentPage * 20, (currentPage + 1) * 20).map(({ player, state }) => (
                <article key={player.id} className="social-list-row">
                  <button className="social-list-person" type="button" onClick={() => setSelected(player.id)}>
                    <span className="social-list-avatar">
                      <SocialAvatar outfit={player.outfit} name={player.name} />
                    </span>
                    <span>
                      <strong>{player.name}</strong>
                      <small>{t('level', { level: player.level })}</small>
                    </span>
                  </button>
                  <FriendActions
                    state={state}
                    pending={pending || loading}
                    onAction={(action) => void change(player.id, action)}
                  />
                </article>
              ))}
            </div>
            {rows.length > 20 && (
              <div className="social-pages">
                <Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                  {t('character.previous', { ns: 'inventory' })}
                </Button>
                <span>
                  {t('character.pageNumber', {
                    ns: 'inventory',
                    page: currentPage + 1,
                    pages: Math.ceil(rows.length / 20),
                  })}
                </span>
                <Button disabled={(currentPage + 1) * 20 >= rows.length} onClick={() => setPage(currentPage + 1)}>
                  {t('character.next', { ns: 'inventory' })}
                </Button>
              </div>
            )}
          </>
        )}
      </Dialog>
      {selected && <PlayerInteractionDialog id={selected} onClose={() => setSelected(undefined)} />}
    </>
  );
}
