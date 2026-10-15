import type { Outfit } from '@chibi-town/character-core/character-types';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { Button } from '@chibi-town/ui/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
import { CharacterInventoryPanel } from '@/features/character/_components/character-inventory-panel';
import { createCharacterLabView } from '@/features/character/_components/character-lab-view';
import {
  createCharacterLabState,
  flipCharacterLab,
  setCharacterLabOutfit,
  tickCharacterLab,
  updateCharacterLab,
} from '@/features/character/_utils/character-lab-logic';
import { AudioSettings } from '@/features/settings/_components/audio-settings';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';
import { CHARACTER_PREVIEW, TICK_MS } from '@/game/runtime/game-config';

export function LabScreen({ audio }: { audio: ReturnType<typeof createGameAudio> }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useMemo(() => ({ current: createCharacterLabState() }), []);
  const view = useRef<ReturnType<typeof createCharacterLabView>>(undefined);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const { t } = useTranslation('inventory');
  useEffect(() => {
    document.body.classList.add('character-lab');
    const ui = createGameUi(document.body, audio);
    const renderers: CharacterRenderer[] = [];
    let disposed = false;

    async function start() {
      const [providers, player] = await Promise.all([createPreviewProviders('phaser'), getApiSdk().getPlayer()]);
      if (disposed) return;
      setCharacterLabOutfit(state.current, player.outfit);
      view.current = createCharacterLabView(host.current!, state.current);
      view.current.sync();
      for (const id of ['big', 'parts', 'poses', 'farm'] as const) {
        const sizes = {
          big: CHARACTER_PREVIEW,
          parts: { width: 504, height: 372, zoom: 2 },
          poses: { width: 588, height: 116, zoom: 2 },
          farm: { width: 480, height: 150, zoom: 2 },
        };
        renderers.push(
          providers.create('phaser', {
            parent: view.current.parents[id],
            ...sizes[id],
            backgroundColor: id === 'farm' ? '#7cb85a' : '#454857',
            renderScale: 2,
            ...(id === 'big'
              ? {
                  fixedStep: {
                    interval: TICK_MS,

                    onTick: () => tickCharacterLab(state.current),
                  },
                }
              : {}),

            onFrame(renderer, now, delta) {
              if (id === 'big') {
                updateCharacterLab(state.current, Math.max(0, Math.min(0.1, delta / 1000)));
                view.current?.drawBig(renderer, now);
              }
              if (id === 'parts') view.current?.drawParts(renderer);
              if (id === 'poses') view.current?.drawPoses(renderer);
              if (id === 'farm') view.current?.drawFarm(renderer, now);
            },
          }),
        );
      }
      setPending(false);
    }

    void start().catch(() => {
      if (!disposed) {
        setError(t('character.loadFailed'));
        setPending(false);
      }
    });
    return () => {
      disposed = true;
      renderers.forEach((renderer) => {
        renderer.destroy();
      });
      ui.destroy();
      document.body.classList.remove('character-lab');
    };
  }, [audio, state, t]);

  function syncOutfit(next: Outfit) {
    setCharacterLabOutfit(state.current, next);
    view.current?.sync();
  }

  return (
    <div className="wrap" ref={host}>
      <Link className="lab-back" href="/">
        {t('character.back')}
      </Link>
      <h1>{t('character.title')}</h1>
      <p className="muted">{t('character.description')}</p>
      {error && <p role="alert">{error}</p>}
      <div className="row">
        <div>
          <div id="big" style={{ width: 416, maxWidth: '100%' }} />
          <div className="bar">
            <Button
              onClick={() => {
                state.current.heroWalking = false;
              }}
            >
              {t('character.stand')}
            </Button>
            <Button
              onClick={() => {
                state.current.heroWalking = true;
              }}
            >
              {t('character.walk')}
            </Button>
            <Button onClick={() => flipCharacterLab(state.current)}>{t('character.flip')}</Button>
          </div>
        </div>
        <div>
          <CharacterInventoryPanel onOutfit={syncOutfit} disabled={pending} />
        </div>
      </div>
      <h2>{t('character.layers')}</h2>
      <div id="parts" />
      <h2>{t('character.poses')}</h2>
      <div id="poses" />
      <h2>{t('character.scene')}</h2>
      <div id="farm" />
      <AudioSettings audio={audio} />
    </div>
  );
}
