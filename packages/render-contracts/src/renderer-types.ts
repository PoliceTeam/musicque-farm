import type { DrawOp } from '@chibi-town/character-core/character-types';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';

/** Native pixel coordinates. Draw calls preserve submission order. Resources stay stable during a mount. */
export type CharacterRenderer = {
  readonly kind: string;
  beginFrame(): void;
  drawPieces(sheetName: string, sheet: SpriteSheet, ops: DrawOp[], x: number, y: number, scale?: number): void;
  rectangle(x: number, y: number, width: number, height: number, color: number, alpha?: number): void;
  surface(
    key: string,
    source: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation?: number,
  ): void;
  label(text: string, x: number, y: number, color: string, border?: string, fontSize?: number): void;
  particles(key: string, effect: ParticleEffect): void;
  aura(key: string, x: number, y: number, rx: number, ry: number, rank: number, part: 'back' | 'front'): void;
  marker(key: string, x: number, y: number): void;
  endFrame(): void;
  resize(width: number, height: number, zoom: number): void;
  setActive(active: boolean): void;
  destroy(): void;
};

export type ParticleEffect = {
  x: number;
  y: number;
  moving: boolean;
  areas: { x0: number; x1: number; y0: number; y1: number }[];
  style: {
    colors: string[];
    vx: number;
    vy: number;
    sway: number;
    life: [number, number];
    size: [number, number];
    gravity: number;
    rate?: [number, number];
  };
};

/** Input resolved by the engine, in world units; no engine objects cross this boundary. */
export type RendererInput = { direction: [number, number] };

export type RendererOptions = {
  parent: HTMLElement;
  width: number;
  height: number;
  zoom: number;
  backgroundColor: string;
  /** Internal rendering density; world coordinates remain native pixels. */
  renderScale?: number;
  /** Filter raster surfaces independently of the pixel avatar textures. */
  smoothSurfaces?: boolean;
  fitParent?: boolean;
  /** Resize the canvas to its parent and cover the world with a bounded camera. */
  fillParent?: boolean;
  camera?: { worldWidth: number; worldHeight: number; zoom?: number; target(): [number, number] };
  /** Optional gameplay controls. Preview-only providers can reject this capability. */
  input?: { onPointerDown(x: number, y: number): void };
  /** Repeating simulation tick owned by the scene clock; paused with the renderer. */
  fixedStep?: { interval: number; onTick(): void };
  /** Called after the provider is ready; delta is milliseconds. Simulation remains in the app. */
  onFrame(renderer: CharacterRenderer, now: number, delta: number, input?: RendererInput): void;
  onReady?(renderer: CharacterRenderer): void;
};
export type RendererProvider = (options: RendererOptions) => CharacterRenderer;
