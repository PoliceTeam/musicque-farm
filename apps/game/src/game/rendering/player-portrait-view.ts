import type { Outfit } from '@chibi-town/character-core/character-types';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import { sheet } from '@/assets/asset-catalog';
import { FigureCache, PieceCache } from '@/game/rendering/canvas-renderer';

/** Reuse the player's equipped sprite; portrait framing changes no artwork. */
export function drawPlayerPortrait(canvas: HTMLCanvasElement, outfit: Outfit) {
  canvas.width = 144;
  canvas.height = 144;
  const g = canvas.getContext('2d')!;
  g.scale(2, 2);
  new FigureCache(new PieceCache(sheet)).draw(g, layoutAvatar(items, sheet, toEquip(outfit), 0, false), 36, 80);
}
