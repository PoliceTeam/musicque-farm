import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';

/** Shared yellow entrance sign used by farm and town locations. */
export function createEntranceHint(label: string) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.font = '900 16px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#60431d';
  ctx.lineWidth = 4;
  ctx.strokeText(label, 32, 16);
  ctx.fillStyle = '#ffed62';
  ctx.fillText(label, 32, 16);
  ctx.beginPath();
  ctx.moveTo(27, 21);
  ctx.lineTo(37, 21);
  ctx.lineTo(37, 30);
  ctx.lineTo(45, 30);
  ctx.lineTo(32, 44);
  ctx.lineTo(19, 30);
  ctx.lineTo(27, 30);
  ctx.closePath();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#ffe33d';
  ctx.fill();
  ctx.strokeStyle = '#fff5a0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(29, 24);
  ctx.lineTo(29, 32);
  ctx.lineTo(24, 32);
  ctx.stroke();
  return c;
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
  view.surface(`entrance-hint:${label}`, source, x - 32, y - 44 + Math.sin(now / 330) * 1.5, 64, 48);
}
