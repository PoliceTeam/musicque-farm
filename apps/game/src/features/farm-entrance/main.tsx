import type { createGameAudio } from '@chibi-town/game-audio';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from '@/application/_components/loading-overlay';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk } from '@/application/api-sdk';
import { farmEntranceCss } from '@/assets/generated-styles';
import { FarmSocialDialog } from '@/features/farm-entrance/_components/farm-social-dialog';
import { ENTRANCE_SIZE, ENTRANCE_TARGETS, type EntranceAction } from '@/features/farm-entrance/_utils/entrance-layout';
import { createFarmEntranceGame } from '@/features/farm-entrance/runtime/farm-entrance-game';

export const styles = farmEntranceCss;

export function Screen({ audio }: { audio: ReturnType<typeof createGameAudio> }) {
  const { t } = useTranslation('farm');
  const { t: common } = useTranslation('common');
  const navigation = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const portals = useRef<HTMLElement>(null);
  const [header, setHeader] = useState<{ player: LocationPlayer; coins: number; gems: number; farmLevel: number }>();
  const [dialog, setDialog] = useState<'menu' | 'friends' | 'history' | 'shop'>();
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing attempt explicitly retries a failed load.
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setFailure(false);
    setReady(false);

    const action = (next: EntranceAction) => {
      audio.play('select');
      if (next === 'exit') navigation.push('/map');
      else if (next === 'home') navigation.push('/farm/home');
      else setDialog(next);
    };

    void Promise.all([getApiSdk().getPlayer(), getApiSdk().getInventory()])
      .then(async ([player, snapshot]) => {
        if (disposed) return;
        setHeader({
          player,
          coins: snapshot.farm.coins,
          gems: snapshot.farm.gems,
          farmLevel: 1 + Math.floor((snapshot.farm.owned - 6) / 6),
        });
        const destroy = await createFarmEntranceGame(
          host.current!,
          player.outfit,
          common('avatarName', { level: player.level, name: player.name }),
          action,
          { enter: common('enterLocation'), exit: common('exitLocation') },
          portals.current,
        );
        if (disposed) destroy();
        else {
          cleanup = destroy;
          setReady(true);
        }
      })
      .catch(() => {
        if (!disposed) setFailure(true);
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [audio, navigation, t, common, attempt]);
  return (
    <LocationLayout
      title={t('entranceTitle')}
      className="farm-entrance-layout"
      onOutfitChange={() => setAttempt((value) => value + 1)}
      audio={audio}
      player={header?.player}
      subtitle={t('profileLevel', { level: header?.player.level ?? '…', farmLevel: header?.farmLevel ?? '…' })}
      coins={header?.coins}
      gems={header?.gems}
      counters={
        <Button
          className="farm-entrance-friends-control"
          aria-label={t('visitFriends')}
          onClick={() => setDialog('menu')}
        >
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M5 5h22v17H17l-6 6v-6H5z" fill="#8bd2f5" stroke="#3d739b" strokeWidth="2" />
            <circle cx="10" cy="13" r="2" fill="#236da4" />
            <circle cx="16" cy="13" r="2" fill="#236da4" />
            <circle cx="22" cy="13" r="2" fill="#236da4" />
          </svg>
        </Button>
      }
    >
      {!ready && !failure && <LoadingOverlay label={common('loadingLocation')} />}
      <div className="farm-entrance-viewport">
        <div className="farm-entrance-scene">
          <div className="farm-entrance-canvas" ref={host} />
          <nav ref={portals} className="farm-entrance-portals" aria-label={t('entranceTitle')}>
            {ENTRANCE_TARGETS.map((target) => {
              const label = t(
                target.action === 'exit'
                  ? 'entranceExit'
                  : target.action === 'home'
                    ? 'ownFarm'
                    : target.action === 'friends'
                      ? 'visitFriends'
                      : target.action === 'shop'
                        ? 'entranceShop'
                        : 'theftHistory',
              );
              return (
                <button
                  key={target.action}
                  type="button"
                  className="farm-entrance-portal"
                  aria-label={label}
                  style={{
                    left: `${(target.x / ENTRANCE_SIZE.width) * 100}%`,
                    top: `${(target.y / ENTRANCE_SIZE.height) * 100}%`,
                    width: `${(target.width / ENTRANCE_SIZE.width) * 100}%`,
                    height: `${(target.height / ENTRANCE_SIZE.height) * 100}%`,
                  }}
                  onClick={() => {
                    audio.play('select');
                    if (target.action === 'exit') navigation.push('/map');
                    else if (target.action === 'home') navigation.push('/farm/home');
                    else setDialog(target.action);
                  }}
                />
              );
            })}
          </nav>
        </div>
      </div>
      {failure && (
        <div className="ui-runtime-error" role="alert">
          {t('artLoadFailed')} <Button onClick={() => setAttempt((value) => value + 1)}>{common('retry')}</Button>
        </div>
      )}
      {dialog === 'menu' && (
        <Dialog
          className="farm-entrance-dialog"
          title={t('farmFriendsMenu')}
          onClose={() => setDialog(undefined)}
          closeLabel={common('close')}
        >
          <div className="farm-entrance-menu">
            <Button variant="primary" onClick={() => setDialog('friends')}>
              {t('visitFriends')}
            </Button>
            <Button onClick={() => setDialog('history')}>{t('theftHistory')}</Button>
          </div>
        </Dialog>
      )}
      {dialog === 'shop' && (
        <Dialog
          className="farm-entrance-dialog"
          title={t('entranceShop')}
          closeLabel={common('close')}
          onClose={() => setDialog(undefined)}
        >
          <p>{t('entranceShopPreview')}</p>
        </Dialog>
      )}
      {(dialog === 'friends' || dialog === 'history') && (
        <FarmSocialDialog key={dialog} mode={dialog} onClose={() => setDialog(undefined)} />
      )}
    </LocationLayout>
  );
}
