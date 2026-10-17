'use client';
import type { Outfit } from '@chibi-town/character-core/character-types';
import type { GameSdk } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
import { CurrencyCounter, CurrencyIcon, GameHeader, ProfileMenu } from '@chibi-town/ui/react';
import Link from 'next/link';
import { type ReactNode, type RefObject, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthClient } from '@/application/auth-client';
import { AuthContext } from '@/application/auth-context';
import { RenameDialog } from '@/features/auth/rename-dialog';
import { AudioSettings } from '@/features/settings/_components/audio-settings';
import { drawPlayerPortrait } from '@/game/rendering/player-portrait-view';

export type LocationPlayer = Awaited<ReturnType<GameSdk['getPlayer']>>;

/** Shared location shell; each screen supplies its own scene, actions and extra counters. */
export function LocationLayout({
  title,
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
}: {
  title: string;
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
}) {
  const { t } = useTranslation('common');
  const authClient = getAuthClient();
  const auth = useContext(AuthContext);
  const [renameOpen, setRenameOpen] = useState(false);
  const portrait = useRef<HTMLCanvasElement>(null);
  const drawnOutfit = useRef('');
  useEffect(() => {
    if (!outfit || !portrait.current) return;
    const key = JSON.stringify(outfit);
    if (drawnOutfit.current === key) return;
    drawPlayerPortrait(portrait.current, outfit);
    drawnOutfit.current = key;
  }, [outfit]);
  return (
    <main className="game-ui ui-location-layout" aria-label={accessibleTitle}>
      <GameHeader
        title={title}
        profile={
          <ProfileMenu
            menuRef={menuRef}
            name={auth.player?.name ?? player?.name ?? '…'}
            subtitle={
              auth.player?.guest
                ? t('guest', { ns: 'auth' })
                : (subtitle ?? t('profileLevel', { level: player?.level ?? '…' }))
            }
            label={t('playerMenu')}
            portrait={<canvas id="player-portrait" ref={portrait} role="img" aria-label={t('portrait')} />}
          >
            <Link href="/character">{t('character')}</Link>
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
        <CurrencyCounter label={t('coins')} icon={<CurrencyIcon kind="coins" />} value={coins} />
        <CurrencyCounter label={t('gems')} icon={<CurrencyIcon kind="gems" />} value={gems} />
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
    </main>
  );
}
