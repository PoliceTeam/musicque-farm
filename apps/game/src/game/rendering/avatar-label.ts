import type { AvatarState } from '@chibi-town/character-core/animation-logic';
import type { Equip } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { nameplateTop } from '@chibi-town/character-core/layout-logic';
import { type CharacterRenderer, MAP_LABEL_STYLE } from '@chibi-town/render-contracts/renderer-types';
import { sheet } from '@/assets/asset-catalog';

const tops = new WeakMap<Equip[], number>();

/** All gameplay maps use this wrapper for player and remote character names. */
export function drawAvatarLabel(
  renderer: CharacterRenderer,
  text: string,
  avatar: AvatarState,
  x: number,
  y: number,
  scale: number,
  player = false,
  border?: string,
) {
  let top = tops.get(avatar.equip);
  if (top === undefined) {
    top = nameplateTop(items, sheet, avatar.equip);
    tops.set(avatar.equip, top);
  }
  renderer.label(
    text,
    Math.round(x),
    Math.round(y) + top * scale - MAP_LABEL_STYLE.headClearance,
    player ? MAP_LABEL_STYLE.playerColor : MAP_LABEL_STYLE.otherColor,
    border,
    MAP_LABEL_STYLE.fontSize,
  );
}

/** Raster NPC service names sit above the head, with a separate red service indicator. */
export function drawNpcLabel(renderer: CharacterRenderer, text: string, x: number, top: number) {
  const labelY = Math.round(top) - MAP_LABEL_STYLE.headClearance;
  renderer.label(text, Math.round(x), labelY, MAP_LABEL_STYLE.playerColor, undefined, MAP_LABEL_STYLE.fontSize, {
    text: '*',
    color: '#ff4444',
  });
}
