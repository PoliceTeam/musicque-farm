'use client';
import type { Outfit } from '@chibi-town/character-core/character-types';
import type { GameSdk } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
import { CurrencyCounter, CurrencyIcon, GameHeader, ProfileMenu } from '@chibi-town/ui/react';
import Link from 'next/link';
import { lazy, type ReactNode, type RefObject, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthClient } from '@/application/auth-client';
import { AuthContext } from '@/application/auth-context';
import { socialCss } from '@/assets/generated-styles';
import { RenameDialog } from '@/features/auth/rename-dialog';
import { AudioSettings } from '@/features/settings/_components/audio-settings';
import { InboxButton } from '@/features/social/_components/inbox-button';
import { SocialNotification } from '@/features/social/_components/social-notification';
import type { SocialTab } from '@/features/social/_utils/friend-notifications';
import { useFriendInbox } from '@/features/social/use-friend-inbox';
import { drawPlayerPortrait } from '@/game/rendering/player-portrait-view';

const FriendsDialog = lazy(() =>
  import('@/features/social/_components/friends-dialog').then((module) => ({ default: module.FriendsDialog })),
);

const CharacterDialog = lazy(() =>
  import('@/features/character/_components/character-dialog').then((module) => ({ default: module.CharacterDialog })),
);

export type LocationPlayer = Awaited<ReturnType<GameSdk['getPlayer']>>;

/** Shared location shell; each screen supplies its own scene, actions and extra counters. */
export function LocationLayout({
  title,
  className,
  profileLabel,
  accessibleTitle = title,
  player,
  outfit = player?.outfit,
  subtitle,
  coins,
  gems,
  audio,
  menuActions,
  menuRef,
  counters,
  children,
  onOutfitChange,
}: {
  title: string;
  className?: string;
  profileLabel?: string;
  accessibleTitle?: string;
  player?: LocationPlayer;
  outfit?: Outfit;
  subtitle?: ReactNode;
  coins?: number;
  gems?: number;
  audio: ReturnType<typeof createGameAudio>;
  menuActions?: ReactNode;
  menuRef?: RefObject<HTMLDetailsElement | null>;
  counters?: ReactNode;
  children: ReactNode;
  onOutfitChange?: (outfit: Outfit) => void;
}) {
  const { t } = useTranslation('common');
  const authClient = getAuthClient();
  const auth = useContext(AuthContext);
  const [renameOpen, setRenameOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friendTab, setFriendTab] = useState<SocialTab>('friends');
  const { incoming: inbox, notice, dismissNotice } = useFriendInbox(auth.player?.id ?? player?.id);
  const [walletOverride, setWalletOverride] = useState<{ coins: number; gems: number }>();
  useEffect(
    () => setWalletOverride(coins === undefined || gems === undefined ? undefined : { coins, gems }),
    [coins, gems],
  );
  const [wornOutfit, setWornOutfit] = useState<Outfit>();
  useEffect(() => setWornOutfit(outfit), [outfit]);
  const portrait = useRef<HTMLCanvasElement>(null);
  const drawnOutfit = useRef('');
  useEffect(() => {
    const current = wornOutfit ?? outfit;
    if (!current || !portrait.current) return;
    const key = JSON.stringify(current);
    if (drawnOutfit.current === key) return;
    drawPlayerPortrait(portrait.current, current);
    drawnOutfit.current = key;
  }, [outfit, wornOutfit]);
  return (
    <main className={['game-ui ui-location-layout', className].filter(Boolean).join(' ')} aria-label={accessibleTitle}>
      <style>{socialCss}</style>
      <GameHeader
        title={title}
        profile={
          <ProfileMenu
            menuRef={menuRef}
            triggerLabel={profileLabel}
            name={auth.player?.name ?? player?.name ?? '…'}
            subtitle={
              inbox > 0
                ? t('newRequests', { ns: 'social', count: inbox })
                : auth.player?.guest
                  ? t('guest', { ns: 'auth' })
                  : (subtitle ?? t('profileLevel', { level: player?.level ?? '…' }))
            }
            label={t('playerMenu')}
            portrait={<canvas id="player-portrait" ref={portrait} role="img" aria-label={t('portrait')} />}
          >
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.closest('details')?.removeAttribute('open');
                setCharacterOpen(true);
              }}
            >
              {t('character')}
            </button>
            <Link href="/">{t('worldMap')}</Link>
            {menuActions}
            {authClient && auth.player && (
              <button type="button" onClick={() => setRenameOpen(true)}>
                {t('rename', { ns: 'auth' })}
              </button>
            )}
            <AudioSettings audio={audio} />
            {auth.player?.guest && (
              <button type="button" onClick={auth.openAuth}>
                {t('saveProgress', { ns: 'auth' })}
              </button>
            )}
            {authClient && !auth.player?.guest && (
              <button type="button" onClick={() => void authClient.logout().finally(() => window.location.assign('/'))}>
                {t('logout', { ns: 'auth' })}
              </button>
            )}
          </ProfileMenu>
        }
      >
        <CurrencyCounter
          label={t('coins')}
          icon={<CurrencyIcon kind="coins" />}
          value={walletOverride?.coins ?? coins}
        />
        <CurrencyCounter label={t('gems')} icon={<CurrencyIcon kind="gems" />} value={walletOverride?.gems ?? gems} />
        {process.env.NEXT_PUBLIC_API_URL && (
          <InboxButton
            count={inbox}
            onClick={() => {
              setFriendTab(inbox > 0 ? 'incoming' : 'friends');
              setFriendsOpen(true);
            }}
          />
        )}
        {counters}
      </GameHeader>
      {renameOpen && authClient && auth.player && (
        <RenameDialog
          client={authClient}
          player={auth.player}
          onClose={() => setRenameOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}
      {children}
      {notice && (
        <SocialNotification
          notice={notice}
          onDismiss={dismissNotice}
          onOpen={(tab) => {
            setFriendTab(tab);
            setFriendsOpen(true);
          }}
        />
      )}
      {friendsOpen && (
        <Suspense fallback={null}>
          <FriendsDialog key={friendTab} initialTab={friendTab} onClose={() => setFriendsOpen(false)} />
        </Suspense>
      )}
      {characterOpen && (
        <Suspense fallback={null}>
          <CharacterDialog
            onBalances={setWalletOverride}
            onClose={() => setCharacterOpen(false)}
            onOutfit={(next) => {
              setWornOutfit(next);
              onOutfitChange?.(next);
            }}
          />
        </Suspense>
      )}
    </main>
  );
}
