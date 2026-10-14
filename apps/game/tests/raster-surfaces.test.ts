import { describe, expect, it, vi } from 'vitest';
import { CharacterView } from '../../../packages/renderer-phaser/src/character-view';

vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { LINEAR: 0 } } } }));

function fixture(smooth: boolean) {
  const texture = { setFilter: vi.fn() };
  const image = {
    setOrigin: vi.fn(() => image),
    setRotation: vi.fn(() => image),
    setTexture: vi.fn(() => image),
    setFlipX: vi.fn(() => image),
    setDisplaySize: vi.fn(() => image),
    setPosition: vi.fn(() => image),
    setDepth: vi.fn(() => image),
    setVisible: vi.fn(() => image),
  };
  const scene = { textures: { addCanvas: vi.fn(() => texture) }, add: { image: vi.fn(() => image) } };
  const view = new CharacterView(scene as unknown as ConstructorParameters<typeof CharacterView>[0], smooth);
  const source = {} as HTMLCanvasElement;
  return { view, scene, texture, source };
}

describe('raster surface sampling', () => {
  it('smooths a raster texture once and reuses it as it rotates over frames', () => {
    const { view, scene, texture, source } = fixture(true);
    for (let frame = 0; frame < 120; frame++) {
      view.beginFrame();
      view.surface('wheel', source, 100, 100, 92, 92, frame / 100);
    }
    expect(scene.textures.addCanvas).toHaveBeenCalledTimes(1);
    expect(scene.add.image).toHaveBeenCalledTimes(1);
    expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(0);
  });
  it('keeps the existing filtering when a scene has not opted in', () => {
    const { view, texture, source } = fixture(false);
    view.surface('old-scene', source, 0, 0, 100, 100);
    expect(texture.setFilter).not.toHaveBeenCalled();
  });
});
