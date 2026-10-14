import { createRendererRegistry } from '@chibi-town/render-contracts/renderer-registry';
import type { CharacterRenderer, RendererOptions } from '@chibi-town/render-contracts/renderer-types';
import { createCanvasProvider } from '@chibi-town/renderer-canvas/canvas-provider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

function browserFixture() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let serial = 0;
  const contexts: ReturnType<typeof contextFixture>[] = [];
  const canvases: { width: number; height: number; style: Record<string, string>; remove: ReturnType<typeof vi.fn> }[] =
    [];

  function contextFixture() {
    return {
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
    };
  }

  vi.stubGlobal('document', {
    createElement: () => {
      const context = contextFixture();
      const canvas = {
        width: 0,
        height: 0,
        style: {},
        remove: vi.fn(),

        getContext: () => context,
      };
      contexts.push(context);
      canvases.push(canvas);
      return canvas;
    },
  });
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const options: RendererOptions = {
    parent: { append: vi.fn() } as unknown as HTMLElement,
    width: 104,
    height: 120,
    zoom: 4,
    backgroundColor: '#454857',
    onFrame: vi.fn(),
    onReady: vi.fn(),
  };
  return {
    callbacks,
    contexts,
    canvases,
    options,

    step(now: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback(now);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('renderer providers', () => {
  it('allows another provider to be registered without sharing registries', () => {
    const registry = createRendererRegistry();
    const custom = vi.fn(() => ({ kind: 'custom' }) as CharacterRenderer);
    const options = {} as RendererOptions;
    registry.register('custom', custom);
    expect(registry.create('custom', options).kind).toBe('custom');
    expect(custom).toHaveBeenCalledWith(options);
    expect(() => registry.register('custom', custom)).toThrow(/already registered/);
    expect(() => createRendererRegistry().create('custom', options)).toThrow(/unknown/);
  });

  it('runs Canvas frames in milliseconds, resizes and disposes without further callbacks', () => {
    const fixture = browserFixture();
    const renderer = createCanvasProvider(fixture.options);
    fixture.step(100);
    fixture.step(116);
    expect(fixture.options.onReady).toHaveBeenCalledWith(renderer);
    expect(fixture.options.onFrame).toHaveBeenLastCalledWith(renderer, 116, 16);
    renderer.resize(80, 90, 2);
    expect(fixture.canvases[0]).toMatchObject({ width: 80, height: 90, style: { width: '160px', height: '180px' } });
    renderer.destroy();
    renderer.destroy();
    fixture.step(132);
    expect(fixture.options.onFrame).toHaveBeenCalledTimes(2);
    expect(fixture.canvases[0].remove).toHaveBeenCalledTimes(1);
    expect(fixture.callbacks.size).toBe(0);
  });

  it('can be destroyed before readiness without leaking a frame', () => {
    const fixture = browserFixture();
    createCanvasProvider(fixture.options).destroy();
    fixture.step(100);
    expect(fixture.options.onReady).not.toHaveBeenCalled();
    expect(fixture.options.onFrame).not.toHaveBeenCalled();
  });

  it('preserves clipping, recoloring, mirrored placement and texture reuse', () => {
    const fixture = browserFixture();
    const renderer = createCanvasProvider(fixture.options);
    const sheet = {
      palette: { K: '#101020' },
      pieces: { hair: { name: 'hair', width: 2, height: 2, rows: ['KK', 'K.'] } },
    };
    const op = { piece: 'hair', x: -2, y: -2, flip: true, clipTop: -1, recolor: { K: '#ff0000' } };
    renderer.beginFrame();
    renderer.drawPieces('character', sheet, [op], 52, 114);
    renderer.endFrame();
    expect(fixture.contexts[1].putImageData.mock.calls[0][0].data).toEqual(
      new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0]),
    );
    expect(fixture.contexts[0].translate.mock.calls).toEqual([
      [50, 112],
      [2, 0],
    ]);
    expect(fixture.contexts[0].scale).toHaveBeenCalledWith(-1, 1);
    renderer.beginFrame();
    renderer.drawPieces('character', sheet, [{ ...op, x: 3, y: 3, clipTop: 4, flip: false }], 0, 0);
    renderer.endFrame();
    expect(fixture.canvases).toHaveLength(2);
    renderer.destroy();
  });

  it('selects Canvas without loading the Phaser adapter and rejects unknown names', async () => {
    const providers = await createPreviewProviders('canvas');
    const fixture = browserFixture();
    const renderer = providers.create('canvas', fixture.options);
    expect(renderer.kind).toBe('canvas');
    renderer.destroy();
    await expect(createPreviewProviders('missing')).rejects.toThrow(/unknown preview renderer/);
  });
});
