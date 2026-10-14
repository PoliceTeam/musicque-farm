'use client';
import { Button } from './button.js';
import { FormField } from './form-field.js';
export type AudioChannel = 'music' | 'effects';

export function AudioSettingsPanel({
  labels = {
    title: 'Âm thanh',
    enable: 'Bật âm thanh',
    disable: 'Tắt âm thanh',
    music: 'Nhạc',
    effects: 'Thao tác',
    musicVolume: 'Âm lượng nhạc',
    effectsVolume: 'Âm lượng thao tác',
  },
  enabled,
  volumes,
  onToggle,
  onVolumeChange,
}: {
  labels?: {
    title: string;
    enable: string;
    disable: string;
    music: string;
    effects: string;
    musicVolume: string;
    effectsVolume: string;
  };
  enabled: boolean;
  volumes: Record<AudioChannel, number>;
  onToggle: () => void;
  onVolumeChange: (channel: AudioChannel, value: number) => void;
}) {
  return (
    <details className="ui-audio-settings-panel">
      <summary>{labels.title}</summary>
      <div className="ui-audio-settings">
        <Button onClick={onToggle} aria-pressed={enabled}>
          {enabled ? labels.disable : labels.enable}
        </Button>
        {(['music', 'effects'] as const).map((channel) => (
          <FormField key={channel} label={labels[channel]}>
            <input
              aria-label={channel === 'music' ? labels.musicVolume : labels.effectsVolume}
              type="range"
              min={0}
              max={100}
              value={Math.round(volumes[channel] * 100)}
              onChange={(event) => onVolumeChange(channel, Number(event.target.value) / 100)}
            />
          </FormField>
        ))}
      </div>
    </details>
  );
}
