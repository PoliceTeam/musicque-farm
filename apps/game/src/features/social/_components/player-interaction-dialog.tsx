import type { FriendAction, PublicProfile } from '@chibi-town/contracts/social';
import { Button, Dialog, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRealtime } from '@/application/api-sdk';
import { characterPanelCss, socialCss } from '@/assets/generated-styles';
import { CharacterProfile } from '@/features/character/_components/character-profile';
import { FriendActions } from '@/features/social/_components/friend-actions';
import { socialClient } from '@/features/social/social-client';
import { socialErrorMessage } from '@/features/social/social-error-message';

export function PlayerInteractionDialog({ id, onClose }: { id: string; onClose(): void }) {
  const { t } = useTranslation('social');
  const [profile, setProfile] = useState<PublicProfile>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const realtime = getRealtime();
    const off = realtime?.subscribe((event) => {
      if (event.type === 'social.changed' || event.type === 'reconnected') setRevision((n) => n + 1);
    });
    realtime?.send({ type: 'social.watch' });
    return off;
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads the authoritative profile after a realtime hint.
  useEffect(() => {
    const current = ++generation.current;
    setError('');
    void socialClient
      .profile(id)
      .then((value) => {
        if (current === generation.current) setProfile(value);
      })
      .catch(() => {
        if (current === generation.current) setError(t('loadFailed'));
      });
    return () => {
      generation.current++;
    };
  }, [id, revision, t]);

  async function change(action: FriendAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const state = await socialClient.change(id, action);
      setProfile((p) => p && { ...p, relationship: state });
    } catch (reason) {
      setError(socialErrorMessage(reason, t));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      title={profile?.name ?? t('player')}
      onClose={onClose}
      closeLabel={t('close', { ns: 'common' })}
      showCloseFooter={false}
      hideTitle
      tabs={
        <Tabs
          appearance="folder"
          label={t('information')}
          value="information"
          items={[{ id: 'information', label: t('information') }]}
          onChange={() => {}}
        />
      }
      className="social-dialog character-dialog"
    >
      <style>{socialCss + characterPanelCss}</style>
      {error && (
        <p role="alert">
          {error}
          <Button onClick={() => setRevision((n) => n + 1)}>{t('retry', { ns: 'common' })}</Button>
        </p>
      )}
      {!profile && !error && <p role="status">{t('loading')}</p>}
      {profile && (
        <>
          <CharacterProfile player={{ ...profile, username: null }} publicView />
          <FriendActions state={profile.relationship} pending={pending} onAction={(action) => void change(action)} />
        </>
      )}
    </Dialog>
  );
}
