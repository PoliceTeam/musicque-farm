import { createRendererRegistry } from '@chibi-town/render-contracts/renderer-registry';

/** Load only the selected engine; register more providers here as the app needs them. */
export async function createPreviewProviders(name: string) {
  const registry = createRendererRegistry();
  if (name === 'phaser') {
    const { createPhaserProvider } = await import('@chibi-town/renderer-phaser/phaser-provider');
    registry.register('phaser', createPhaserProvider);
  } else if (name === 'canvas') {
    const { createCanvasProvider } = await import('@chibi-town/renderer-canvas/canvas-provider');
    registry.register('canvas', createCanvasProvider);
  } else throw new Error(`unknown preview renderer: ${name}`);
  return registry;
}
