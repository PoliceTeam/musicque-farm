import type { createGameAudio } from '@chibi-town/game-audio';
import { AudioSettingsPanel } from '@chibi-town/ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Audio = ReturnType<typeof createGameAudio>;

export function AudioSettings({ audio }: { audio: Audio }) {
  const { t } = useTranslation('settings');
  const [state, setState] = useState(() => ({ enabled: audio.enabled, volumes: { ...audio.volumes } }));
  useEffect(
    () => audio.subscribe((next) => setState({ enabled: next.enabled, volumes: { ...audio.volumes } })),
    [audio],
  );
  return (
    <AudioSettingsPanel
      labels={{
        title: t('audio'),
        enable: t('enableAudio'),
        disable: t('disableAudio'),
        music: t('music'),
        effects: t('effects'),
        musicVolume: t('musicVolume'),
        effectsVolume: t('effectsVolume'),
      }}
      enabled={state.enabled}
      volumes={state.volumes}
      onToggle={() => audio.toggle()}
      onVolumeChange={(channel, value) => {
        audio.setVolume(channel, value);
        setState({ enabled: audio.enabled, volumes: { ...audio.volumes } });
      }}
    />
  );
}
