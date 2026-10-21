import type { FriendAction, PublicProfile } from '@chibi-town/contracts/social';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRealtime } from '@/application/api-sdk';
import { socialCss } from '@/assets/generated-styles/social-css';
import { socialClient } from '@/features/social/social-client';
import { socialErrorMessage } from '@/features/social/social-error-message';

function RadialIcon({ information = false }: { information?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {information ? (
        <>
          <circle cx="13" cy="13" r="8" fill="#e5f4f4" />
          <path d="m19 19 9 9" strokeWidth="5" />
          <path d="M13 11v6m0-10h.01" />
        </>
      ) : (
        <>
          <circle cx="11" cy="10" r="4" fill="#dfeac3" />
          <circle cx="22" cy="12" r="3" fill="#dfeac3" />
          <path d="M3 26v-3a8 8 0 0 1 16 0v3m2-9a6 6 0 0 1 8 6v3M24 3v5m-2.5-2.5h5" />
        </>
      )}
    </svg>
  );
}

export function PlayerRadialMenu({
  id,
  anchor,
  menuRef,
  onClose,
  onInformation,
}: {
  id: string;
  anchor: [number, number];
  menuRef: RefObject<HTMLDivElement | null>;
  onClose(): void;
  onInformation(): void;
}) {
  const { t } = useTranslation('social');
  const [profile, setProfile] = useState<PublicProfile>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    function outside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }

    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
    };
  }, [onClose, menuRef]);
  useEffect(() => {
    const realtime = getRealtime();
    const off = realtime?.subscribe((event) => {
      if (event.type === 'social.changed' || event.type === 'reconnected') setRevision((v) => v + 1);
    });
    realtime?.send({ type: 'social.watch' });
    return off;
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes the relationship on realtime invalidation.
  useEffect(() => {
    let active = true;
    void socialClient
      .profile(id)
      .then((p) => {
        if (active) {
          setProfile(p);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError(t('loadFailed'));
      });
    return () => {
      active = false;
    };
  }, [id, revision, t]);

  async function change(action: FriendAction) {
    if (busy.current) return;
    if (action === 'remove' && !confirm) {
      setConfirm(true);
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const state = await socialClient.change(id, action);
      setProfile((p) => p && { ...p, relationship: state });
      setConfirm(false);
    } catch (reason) {
      setError(socialErrorMessage(reason, t));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const state = profile?.relationship;
  const action: FriendAction =
    state === 'incoming' ? 'accept' : state === 'outgoing' ? 'cancel' : state === 'friends' ? 'remove' : 'request';
  return (
    <div
      ref={menuRef}
      className="player-radial-menu"
      role="toolbar"
      aria-label={profile?.name ?? t('player')}
      data-edge={
        anchor[0] < 180 ? 'left' : typeof window !== 'undefined' && anchor[0] > window.innerWidth - 180 ? 'right' : ''
      }
      data-bottom={typeof window !== 'undefined' && anchor[1] > window.innerHeight - 180}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}
      style={{ left: anchor[0], top: anchor[1] }}
    >
      <style>{socialCss}</style>
      <button className="radial-action radial-information" type="button" onClick={onInformation}>
        <span className="radial-caption">{t('information')}</span>
        <span className="radial-disc">
          <RadialIcon information />
        </span>
      </button>
      <button
        className="radial-action radial-friend"
        type="button"
        disabled={!profile || pending}
        onClick={() => void change(action)}
      >
        <span className="radial-caption">{t(confirm ? 'confirmRemove' : `actions.${action}`)}</span>
        <span className="radial-disc">
          <RadialIcon />
        </span>
      </button>
      {state === 'incoming' && (
        <button className="radial-secondary" type="button" disabled={pending} onClick={() => void change('decline')}>
          {t('actions.decline')}
        </button>
      )}
      <button className="radial-dismiss" type="button" onClick={onClose} aria-label={t('close', { ns: 'common' })}>
        ×
      </button>
      <div className="radial-status" aria-live="polite">
        {error ? (
          <span role="alert">
            {error}{' '}
            <button type="button" onClick={() => setRevision((v) => v + 1)}>
              {t('retry', { ns: 'common' })}
            </button>
          </span>
        ) : profile ? (
          <>
            <strong>{profile.name}</strong>
            <span>{t(`states.${profile.relationship}`)}</span>
          </>
        ) : (
          t('loading')
        )}
      </div>
    </div>
  );
}
