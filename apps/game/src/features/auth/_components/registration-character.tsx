import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import {
  defaultOutfit,
  femaleOutfit,
  starterFieldOptions,
  starterOutfitFields,
  toEquip,
} from '@chibi-town/character-core/outfit-logic';
import { Select, Tabs } from '@chibi-town/ui/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sheet } from '@/assets/asset-catalog';
import { FigureCache, PieceCache } from '@/game/rendering/canvas-renderer';

const choices: { key: keyof Outfit; color?: keyof Outfit }[] = [
  { key: 'hair' },
  { key: 'face' },
  { key: 'eyeColor' },
  { key: 'skin' },
  { key: 'shirt', color: 'shirtColor' },
  { key: 'wrist', color: 'wristColor' },
  { key: 'pants', color: 'pantsColor' },
  { key: 'shoes', color: 'shoesColor' },
];

export function RegistrationCharacter({
  outfit,
  onChange,
  disabled,
}: {
  outfit: Outfit;
  onChange: (outfit: Outfit) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation('auth');
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = preview.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 192, 240);
    context.save();
    context.scale(3, 3);
    context.imageSmoothingEnabled = false;
    new FigureCache(new PieceCache(sheet)).draw(context, layoutAvatar(items, sheet, toEquip(outfit), 0, false), 32, 72);
    context.restore();
  }, [outfit]);
  return (
    <fieldset className="auth-character" disabled={disabled}>
      <legend>{t('character')}</legend>
      <Tabs
        label={t('gender')}
        value={outfit.gender}
        items={[
          { id: 'male', label: t('male') },
          { id: 'female', label: t('female') },
        ]}
        onChange={(gender) => {
          if (!disabled) onChange({ ...(gender === 'female' ? femaleOutfit : defaultOutfit) });
        }}
      />
      <div className="auth-character-editor">
        <canvas ref={preview} width={192} height={240} role="img" aria-label={t('preview')} />
        <div className="auth-character-fields">
          {choices.map(({ key, color }) => {
            const field = starterOutfitFields.find((field) => field.key === key)!;
            const colorField = color ? starterOutfitFields.find((field) => field.key === color) : undefined;
            const options = starterFieldOptions(field, outfit);
            const items = colorField
              ? options.flatMap(([item, label]) =>
                  item
                    ? starterFieldOptions(colorField, outfit).map(([value, colorLabel]) => ({
                        value: `${item}|${value}`,
                        label: `${label} · ${colorLabel}`,
                      }))
                    : [{ value: '|', label }],
                )
              : options.map(([value, label]) => ({ value, label }));
            const current = color ? `${outfit[key]}|${outfit[key] ? outfit[color] : ''}` : outfit[key];
            if (!items.some((item) => item.value === current))
              items.unshift({ value: current, label: t('currentAppearance') });
            return (
              <Select
                key={key}
                label={field.label}
                value={current}
                disabled={disabled}
                items={items}
                onChange={(value) => {
                  if (!color) onChange({ ...outfit, [key]: value });
                  else {
                    const [item, selectedColor] = value.split('|');
                    onChange({ ...outfit, [key]: item, ...(selectedColor ? { [color]: selectedColor } : {}) });
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
