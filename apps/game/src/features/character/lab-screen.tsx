import type { Outfit } from '@chibi-town/character-core/character-types';
import {
  defaultOutfit,
  femaleOutfit,
  fieldOptions,
  gokuOutfit,
  outfitFields,
  randomOutfit,
} from '@chibi-town/character-core/outfit-logic';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { Button, FormField, Tabs } from '@chibi-town/ui/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiSdk } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
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
  const [outfit, setOutfit] = useState<Outfit>({ ...defaultOutfit });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    document.body.classList.add('character-lab');
    const ui = createGameUi(document.body, audio);
    const renderers: CharacterRenderer[] = [];
    let disposed = false;

    async function start() {
      const [providers, player] = await Promise.all([createPreviewProviders('phaser'), getApiSdk().getPlayer()]);
      if (disposed) return;
      setCharacterLabOutfit(state.current, player.outfit);
      setOutfit(state.current.outfit);
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
        setError('Không tải được nhân vật. Vui lòng thử lại sau.');
        setPending(false);
      }
    });
    return () => {
      disposed = true;
      alive.current = false;
      renderers.forEach((renderer) => {
        renderer.destroy();
      });
      ui.destroy();
      document.body.classList.remove('character-lab');
    };
  }, [audio, state]);

  async function change(next: Outfit) {
    if (busy.current || pending) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = await getApiSdk().execute({
        type: 'equip-outfit',
        outfit: next,
        mapInstanceId: 'home',
        requestId: crypto.randomUUID(),
      });
      if (!alive.current) return;
      setCharacterLabOutfit(state.current, result.outfit);
      setOutfit(state.current.outfit);
      view.current?.sync();
      audio.play('success');
    } catch {
      if (alive.current) setError('Không lưu được trang phục.');
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <div className="wrap" ref={host}>
      <Link className="lab-back" href="/">
        ← Về map
      </Link>
      <h1>Chibi Town · Nhân vật</h1>
      <p className="muted">Chọn trang phục và xem nhân vật chuyển động. Thay đổi được lưu tự động.</p>
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
              Đứng
            </Button>
            <Button
              onClick={() => {
                state.current.heroWalking = true;
              }}
            >
              Đi
            </Button>
            <Button onClick={() => flipCharacterLab(state.current)}>Quay trái/phải</Button>
            <Button disabled={pending} onClick={() => void change(randomOutfit(undefined, outfit.gender))}>
              Ngẫu nhiên
            </Button>
            <Button
              disabled={pending}
              onClick={() => void change({ ...(outfit.gender === 'male' ? gokuOutfit : femaleOutfit) })}
            >
              Bộ cơ bản
            </Button>
          </div>
        </div>
        <div>
          <Tabs
            items={[
              { id: 'male', label: 'Nam' },
              { id: 'female', label: 'Nữ' },
            ]}
            value={outfit.gender}
            onChange={(gender) => void change({ ...(gender === 'male' ? defaultOutfit : femaleOutfit) })}
          />
          <div className="fields">
            {outfitFields.map((field) => (
              <FormField key={field.key} label={field.label}>
                <select
                  value={outfit[field.key]}
                  disabled={
                    pending ||
                    Boolean(field.levelOf && (!outfit[field.levelOf] || fieldOptions(field, outfit).length < 2)) ||
                    (field.key === 'hairColor' && !outfit.hair)
                  }
                  onChange={(event) => void change({ ...outfit, [field.key]: event.target.value })}
                >
                  {fieldOptions(field, outfit).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            ))}
          </div>
        </div>
      </div>
      <h2>Các lớp tách riêng</h2>
      <div id="parts" />
      <h2>Các tư thế</h2>
      <div id="poses" />
      <h2>Trong cảnh</h2>
      <div id="farm" />
      <AudioSettings audio={audio} />
    </div>
  );
}
