import { createRendererRegistry } from '@chibi-town/render-contracts/renderer-registry';
import { currentPerformanceLoad, performanceMark, performanceSpan } from '@/application/performance-log';

/** Load only the selected engine; register more providers here as the app needs them. */
export async function createPreviewProviders(name: string) {
  const registry = createRendererRegistry();
  if (name === 'phaser') {
    const run = currentPerformanceLoad();
    const imported = performanceSpan('renderer-import', run);
    const { createPhaserProvider } = await import('@chibi-town/renderer-phaser/phaser-provider');
    imported();
    registry.register('phaser', (options) => {
      const initialized = performanceSpan('renderer-init', run);
      return createPhaserProvider({
        ...options,

        onReady(renderer) {
          initialized();
          options.onReady?.(renderer);
        },

        onFrame(...args) {
          options.onFrame(...args);
          performanceMark('first-frame-submitted', run);
        },
      });
    });
  } else if (name === 'canvas') {
    const { createCanvasProvider } = await import('@chibi-town/renderer-canvas/canvas-provider');
    registry.register('canvas', createCanvasProvider);
  } else throw new Error(`unknown preview renderer: ${name}`);
  return registry;
}

/** World overview uses the same composition boundary and never imports Phaser during SSR. */
export async function createWorldMapRenderer(
  options: import('@chibi-town/renderer-phaser/world-map-view').WorldMapViewOptions,
) {
  const run = currentPerformanceLoad();
  const imported = performanceSpan('renderer-import', run);
  const { createWorldMapView } = await import('@chibi-town/renderer-phaser/world-map-view');
  imported();
  const initialized = performanceSpan('renderer-init', run);
  return createWorldMapView({
    ...options,

    onReady() {
      initialized();
      options.onReady?.();
    },

    onFirstFrame() {
      performanceMark('first-frame-submitted', run);
      options.onFirstFrame?.();
    },

    onSelect(zone) {
      performanceMark('zone-selected', run);
      options.onSelect?.(zone);
    },
  });
}
