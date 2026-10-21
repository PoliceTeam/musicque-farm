import { MAP_LABEL_STYLE } from '@chibi-town/render-contracts/renderer-types';
import { CharacterView } from '@chibi-town/renderer-phaser/character-view';
import { expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { NEAREST: 1 } } } }));

it('keeps map typography stable across camera scales without rebuilding unchanged text every frame', () => {
  const texture = { setFilter: vi.fn() };
  const text = { texture } as Record<string, unknown>;
  for (const method of [
    'setOrigin',
    'setScale',
    'setResolution',
    'setText',
    'setFontSize',
    'setColor',
    'setStroke',
    'setShadow',
    'setPosition',
    'setDepth',
    'setVisible',
    'setY',
    'setBackgroundColor',
    'setPadding',
    'setAlign',
  ])
    text[method] = vi.fn(() => text);
  const scene = {
    add: { text: vi.fn((_x: number, _y: number, _text: string, _style: unknown) => text) },
    game: { canvas: { getBoundingClientRect: vi.fn(() => ({ width: 1000 })) } },
    scale: { width: 2000 },
    cameras: { main: { zoom: 2 } },
  };
  const view = new CharacterView(scene as unknown as ConstructorParameters<typeof CharacterView>[0]);
  for (const zoom of [1, 2, 3.25]) {
    scene.cameras.main.zoom = zoom;
    view.beginFrame();
    view.label('LV 1 Bé Chibi', 400, 500, MAP_LABEL_STYLE.playerColor);
    const scale = vi.mocked(text.setScale as ReturnType<typeof vi.fn>).mock.lastCall![0] as number;
    expect((scale * zoom * 1000) / 2000).toBeCloseTo(1);
    expect(text.setFontSize).toHaveBeenLastCalledWith(14);
    expect(text.setStroke).toHaveBeenLastCalledWith('#49320e', 3);
  }
  for (let frame = 0; frame < 120; frame++) {
    view.beginFrame();
    view.label('LV 1 Bé Chibi', 400 + frame, 500, MAP_LABEL_STYLE.playerColor);
  }
  // Moving a name for 120 frames must not rebuild its canvas or GPU texture.
  expect(scene.game.canvas.getBoundingClientRect).toHaveBeenCalledTimes(123);
  expect(text.setColor).toHaveBeenCalledTimes(1);
  expect(text.setShadow).toHaveBeenCalledTimes(1);
  expect(text.setText).toHaveBeenCalledTimes(1);
  expect(text.setFontSize).toHaveBeenCalledTimes(1);
  expect(text.setStroke).toHaveBeenCalledTimes(1);
  expect(scene.add.text).toHaveBeenCalledTimes(1);
  expect(scene.add.text.mock.calls[0][3]).toMatchObject({
    fontFamily: 'system-ui, sans-serif',
    fontStyle: 'bold',
    fontSize: 14,
  });
  expect(text.setResolution).toHaveBeenCalledExactlyOnceWith(1);
  expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(1);
  view.beginFrame();
  view.label('LV 2 Bạn', 20, 40, '#ffffff', '#ff00ff', 16);
  expect(text.setText).toHaveBeenLastCalledWith('LV 2 Bạn');
  expect(text.setFontSize).toHaveBeenLastCalledWith(16);
  expect(text.setColor).toHaveBeenLastCalledWith('#ffffff');
  expect(text.setShadow).toHaveBeenLastCalledWith(0, 0, '#ff00ff', 3, true, false);
  view.beginFrame();
  view.label('LV 2 Bạn', 30, 40, '#ffffff', undefined, 16);
  expect(text.setShadow).toHaveBeenLastCalledWith(0, 0, '#49320e', 0, true, false);
  expect(text.setColor).toHaveBeenCalledTimes(2);
  // Bubble bottom stays above the full CSS-height name, at every camera zoom.
  for (const zoom of [1, 2, 3.25]) {
    scene.cameras.main.zoom = zoom;
    view.beginFrame();
    view.speechBubble('<b>Xin chào</b>\nCả khu', 100, 200);
    const scale = 2 / zoom;
    expect(text.setY).toHaveBeenLastCalledWith(200 - 24 * scale);
    expect(text.setBackgroundColor).toHaveBeenLastCalledWith('#263b30');
    expect(text.setText).toHaveBeenLastCalledWith('<b>Xin chào</b>\nCả khu');
  }
  expect(text.setBackgroundColor).toHaveBeenCalledTimes(1);
  view.beginFrame();
  view.label('Tên vẫn bình thường', 100, 200, '#ffe066');
  expect(text.setBackgroundColor).toHaveBeenLastCalledWith('');
  expect(text.setPadding).toHaveBeenLastCalledWith(2, 2, 2, 2);
});
