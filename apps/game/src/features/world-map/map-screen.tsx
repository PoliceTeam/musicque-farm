import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import {
  createWorldMapView,
  type WorldMapLife,
  type WorldMapSprite,
  type WorldMapView,
} from '@chibi-town/renderer-phaser/world-map-view';

import { publicAssetUrls } from '@/assets/generated-assets';
import { mapDeliveryAssets, mapSpriteAtlas } from '@/assets/generated-map-assets';
import spriteMeta from '@/assets/map/sprites.json';

const baseUrl = mapDeliveryAssets['world-map.jpg'].src;
const cloudsUrl = mapDeliveryAssets['world-map-clouds-v3.png'].src;

import landmarks from '@/assets/map/world-map-landmarks.json';
import life from '@/assets/map/world-map-life.json';

const lightsUrl = publicAssetUrls['map/world-map-lights.png'];
const maskUrl = publicAssetUrls['map/world-map-mask.png'];
const skyUrl = mapDeliveryAssets['world-map-sky-clean.png'].src;
const surfUrl = publicAssetUrls['map/world-map-surf.png'];
const zonesUrl = publicAssetUrls['map/world-map-zones.png'];

import { mapCss as screenCss, spriteUrls } from '@/assets/generated-styles-and-assets';
import {
  WORLD_DECOR,
  WORLD_MAP_SIZE,
  WORLD_WALKWAYS,
  WORLD_ZONES,
  type WorldZone,
} from '@/features/world-map/_utils/world-map-data';
import {
  lightingAt,
  vietnamHour,
  walkableAt,
  walkRoute,
  worldTimePhase,
  zoneAt,
} from '@/features/world-map/_utils/world-map-logic';

function spriteMap(): Record<string, WorldMapSprite> {
  const out: Record<string, WorldMapSprite> = {};
  for (const [name, meta] of Object.entries({ ...spriteMeta, ...landmarks } as unknown as Record<
    string,
    Omit<WorldMapSprite, 'url'>
  >)) {
    if (name.startsWith('label-') || ['windmill', 'ferris-wheel', 'ferris-legs', 'plane'].includes(name)) continue;
    const url = Object.entries(spriteUrls).find(([path]) => path.endsWith(`/${name}.png`))?.[1];
    if (url) out[name] = { ...meta, url };
  }
  for (const entry of life) {
    const url = Object.entries(spriteUrls).find(([path]) => path.endsWith(`/${entry.id}.png`))?.[1];
    if (url) out[entry.id] = { url, x: entry.at[0], y: entry.at[1], w: entry.size[0], h: entry.size[1] };
  }
  return out;
}

import { Button } from '@chibi-town/ui/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiSdk } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
import { AudioSettings } from '@/features/settings/_components/audio-settings';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

const PRESETS = { real: undefined, dawn: 6.1, day: 11, evening: 16.8, sunset: 18, night: 22 } as const;
type Mode = keyof typeof PRESETS | 'manual';
export const styles = screenCss;

export function MapScreen({
  audio,
  backgroundOnly = false,
}: {
  audio: ReturnType<typeof createGameAudio>;
  backgroundOnly?: boolean;
}) {
  const { t } = useTranslation('common');
  const host = useRef<HTMLDivElement>(null);
  const settings = useRef<HTMLDetailsElement>(null);
  const lighting = useRef(lightingAt(vietnamHour(Date.now())));
  const clock = useRef({ hour: vietnamHour(Date.now()), mode: 'real' as Mode, offset: 0 });
  const [hour, setHour] = useState(() => vietnamHour(Date.now()));
  const [mode, setMode] = useState<Mode>('real');
  const [selected, setSelected] = useState<WorldZone>();
  const [available, setAvailable] = useState<Record<string, MapDefinition[]>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    document.body.classList.add('world-map-page');
    const ui = createGameUi(document.body, audio);
    if (!backgroundOnly && process.env.NEXT_PUBLIC_API_URL) {
      void getApiSdk()
        .getInventory()
        .then((snapshot) => {
          if (!disposed) clock.current.offset = snapshot.serverTime - Date.now();
        })
        .catch(() => {
          /* Keep browser time if the clock snapshot cannot be loaded. */
        });
    }
    if (!backgroundOnly)
      void getApiSdk()
        .getWorld()
        .then((world) => {
          if (disposed) return;
          setAvailable(
            Object.fromEntries(
              world.regions.map((region) => [
                region.id,
                world.maps.filter(
                  (map) => map.regionId === region.id && region.maps.includes(map.id) && map.id !== 'arcade-hall',
                ),
              ]),
            ),
          );
        })
        .catch(() => {
          if (!disposed) setError(t('mapLoadFailed'));
        });
    const view: WorldMapView = createWorldMapView({
      parent: host.current!,
      size: WORLD_MAP_SIZE,
      images: {
        base: baseUrl,
        sky: skyUrl,
        clouds: cloudsUrl,
        surf: surfUrl,
        mask: maskUrl,
        lights: lightsUrl,
        zones: zonesUrl,
      },
      sprites: spriteMap(),
      spriteAtlas: mapSpriteAtlas,
      zones: WORLD_ZONES,
      decor: WORLD_DECOR,
      walkRoute,

      canWalk: (point) => walkableAt(point, WORLD_WALKWAYS),

      life: life as unknown as WorldMapLife[],

      lighting: () => lighting.current,

      zoneAt: (point) => zoneAt(point, WORLD_ZONES),

      onHover() {},

      onSelect(zone) {
        if (backgroundOnly) return;
        if (zone.id === 'farm') {
          void Promise.all([
            import('@/features/farm/main'),
            import('@/features/farm/_utils/farm-scene-assets').then(({ loadFarmSceneAssets }) => loadFarmSceneAssets()),
            createPreviewProviders('phaser'),
          ]).catch(() => {});
        }
        setSelected(WORLD_ZONES.find((item) => item.id === zone.id));
        audio.play('select', zone.id);
      },
    });
    let frame = 0,
      previous = performance.now(),
      rendered = 0;

    const tick = (now: number) => {
      const state = clock.current;
      if (state.mode === 'real') state.hour = vietnamHour(Date.now(), state.offset);
      const goal = lightingAt(state.hour);
      const k = 1 - Math.exp(-Math.min(now - previous, 100) / 450);
      previous = now;
      for (const phase of ['day', 'evening', 'night', 'dawn'] as const)
        lighting.current[phase] += (goal[phase] - lighting.current[phase]) * k;
      if (now - rendered > 250) {
        setHour(state.hour);
        rendered = now;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(undefined);
        if (settings.current) settings.current.open = false;
      }
    };

    window.addEventListener('keydown', key);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key);
      view.destroy();
      ui.destroy();
      document.body.classList.remove('world-map-page');
    };
  }, [audio, t, backgroundOnly]);

  function changeMode(next: keyof typeof PRESETS) {
    clock.current.mode = next;
    setMode(next);
    const preset = PRESETS[next];
    if (preset !== undefined) clock.current.hour = preset;
    else clock.current.hour = vietnamHour(Date.now(), clock.current.offset);
    setHour(clock.current.hour);
  }

  const minutes = Math.round(hour * 60) % 1440;
  const backdrop = { background: `center / cover no-repeat url("${baseUrl}")` };
  if (backgroundOnly)
    return <div id="map" ref={host} aria-hidden="true" style={{ ...backdrop, pointerEvents: 'none' }} />;
  return (
    <>
      <div id="map" ref={host} style={backdrop} />
      <main className="world-shell">
        <div className="time-tools">
          <details ref={settings} className="time-settings">
            <summary>
              <span className="weather-icon">{hour >= 19 || hour < 5 ? '🌙' : '☀️'}</span>
              <span>
                <b className="time-name">Chibi Town</b>
                <small>
                  <output>
                    {String(Math.floor(minutes / 60)).padStart(2, '0')}:{String(minutes % 60).padStart(2, '0')}
                  </output>{' '}
                  · {t(`mapTimeModes.${worldTimePhase(hour)}`)}
                </small>
              </span>
            </summary>
            <div className="time-popover">
              <div className="time-presets">
                {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((next) => (
                  <Button
                    key={next}
                    aria-label={t(`mapTimeModes.${next}`)}
                    aria-pressed={mode === next}
                    aria-current={mode === 'real' && next === worldTimePhase(hour) ? 'time' : undefined}
                    onClick={() => changeMode(next)}
                  >
                    {t(`mapTimeModes.${next}`)}
                  </Button>
                ))}
              </div>
              <label>
                {t('mapTimeOfDay')}
                <input
                  aria-label={t('mapTimeOfDay')}
                  type="range"
                  min={0}
                  max={23.9}
                  step={0.1}
                  value={hour}
                  onChange={(event) => {
                    clock.current.mode = 'manual';
                    clock.current.hour = Number(event.target.value);
                    setMode('manual');
                    setHour(clock.current.hour);
                  }}
                />
              </label>
              <p>{t('mapCurrentPhase', { phase: t(`mapTimeModes.${worldTimePhase(hour)}`) })}</p>
              <p>{t('mapTimeHint')}</p>
              <AudioSettings audio={audio} />
            </div>
          </details>
        </div>
        {error && <p role="alert">{error}</p>}
        {selected && (
          <section className="map-panel" aria-labelledby="destination-title">
            <header className="destination-header">
              <span className="selected-icon" aria-hidden="true">
                {selected.icon}
              </span>
              <div className="destination-heading">
                <small>{t('destinationEyebrow')}</small>
                <h2 id="destination-title">{selected.label}</h2>
              </div>
              <Button
                className="close-selection"
                aria-label={t('closeDestination')}
                onClick={() => setSelected(undefined)}
              >
                ×
              </Button>
            </header>
            <p className="destination-description">
              {!available[selected.id]?.length
                ? t('destinationPreparing')
                : selected.id === 'farm'
                  ? t('destinationFarm')
                  : selected.id === 'fun'
                    ? t('destinationFun')
                    : t('destinationChoose')}
            </p>
            {available[selected.id]?.length ? (
              <nav className="map-destinations" aria-label={t('destinationChoose')}>
                {available[selected.id].map((map) => (
                  <Link
                    key={map.id}
                    className="enter-zone"
                    aria-label={t('visitLocation', { name: map.label })}
                    href={`/play/${map.regionId}/${map.id}`}
                    onClick={() => audio.play('enter')}
                  >
                    <span>{available[selected.id].length === 1 ? t('visitDestination') : map.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </nav>
            ) : (
              <span className="coming-soon">{t('destinationComingSoon')}</span>
            )}
          </section>
        )}
      </main>
    </>
  );
}
