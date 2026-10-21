import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';

export const ENTRANCE_HINT_SIZE = { width: 48, height: 40, tip: 38 } as const;

/** Shared yellow entrance sign used by farm and town locations. */
export function createEntranceHint(label: string) {
  const c = document.createElement('canvas');
  c.width = ENTRANCE_HINT_SIZE.width * 2;
  c.height = ENTRANCE_HINT_SIZE.height * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.font = '900 12px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#60431d';
  ctx.lineWidth = 3;
  ctx.strokeText(label, 24, 12);
  ctx.fillStyle = '#ffed62';
  ctx.fillText(label, 24, 12);
  ctx.beginPath();
  ctx.moveTo(20, 19);
  ctx.lineTo(28, 19);
  ctx.lineTo(28, 27);
  ctx.lineTo(33, 27);
  ctx.lineTo(24, 38);
  ctx.lineTo(15, 27);
  ctx.lineTo(20, 27);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffe33d';
  ctx.fill();
  ctx.strokeStyle = '#fff5a0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(22, 22);
  ctx.lineTo(22, 29);
  ctx.lineTo(19, 29);
  ctx.stroke();
  return c;
}

export function entranceHintPlacement(x: number, y: number, now: number, phase = 0) {
  return {
    x: x - ENTRANCE_HINT_SIZE.width / 2,
    y: y - ENTRANCE_HINT_SIZE.tip + Math.sin(now / 330 + phase) * 1.5,
    width: ENTRANCE_HINT_SIZE.width,
    height: ENTRANCE_HINT_SIZE.height,
  };
}

/** A shared footprint and pulse; x/y identify the ground point the arrow points at. */
export function drawEntranceHint(
  view: CharacterRenderer,
  label: string,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  now: number,
) {
  const at = entranceHintPlacement(x, y, now);
  view.surface(`entrance-hint:${label}`, source, at.x, at.y, at.width, at.height);
}
