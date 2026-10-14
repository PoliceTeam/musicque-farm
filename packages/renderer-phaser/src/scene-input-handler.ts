import type { RendererInput } from '@chibi-town/render-contracts/renderer-types';
import type Phaser from 'phaser';

/** Phaser owns key state, mouse/touch events and camera coordinate conversion. */
export function bindSceneInput(scene: Phaser.Scene, onPointerDown: (x: number, y: number) => void) {
  const keyboard = scene.input.keyboard!;
  const keys = keyboard.addKeys({
    up: 'UP',
    down: 'DOWN',
    left: 'LEFT',
    right: 'RIGHT',
    w: 'W',
    a: 'A',
    s: 'S',
    d: 'D',
  }) as Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  const onPointer = (pointer: Phaser.Input.Pointer) => {
    if (!pointer.leftButtonDown()) return;
    scene.game.canvas.focus({ preventScroll: true });
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    onPointerDown(world.x, world.y);
  };

  scene.input.on('pointerdown', onPointer);

  const read = (): RendererInput => {
    if (document.activeElement !== scene.game.canvas) {
      keyboard.resetKeys();
      return { direction: [0, 0] };
    }
    return {
      direction: [
        Number(keys.right.isDown || keys.d.isDown) - Number(keys.left.isDown || keys.a.isDown),
        Number(keys.down.isDown || keys.s.isDown) - Number(keys.up.isDown || keys.w.isDown),
      ],
    };
  };

  const reset = () => keyboard.resetKeys();

  scene.game.canvas.addEventListener('blur', reset);

  const dispose = () => {
    scene.input.off('pointerdown', onPointer);
    scene.game.canvas.removeEventListener('blur', reset);
  };

  scene.events.once('shutdown', dispose);
  return read;
}
