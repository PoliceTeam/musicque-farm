import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, test } from 'node:test';
import { bindSceneInput } from '../dist/scene-input-handler.js';

const originalDocument = globalThis.document;
afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

function fixture() {
  const canvas = new EventTarget();
  globalThis.document = { activeElement: canvas };
  canvas.focus = () => {
    globalThis.document.activeElement = canvas;
  };
  const keys = Object.fromEntries(
    ['up', 'down', 'left', 'right', 'w', 'a', 's', 'd'].map((name) => [name, { isDown: false }]),
  );
  const input = new EventEmitter();
  input.keyboard = {
    addKeys: () => keys,

    resetKeys: () => {
      for (const key of Object.values(keys)) key.isDown = false;
    },
  };
  const events = new EventEmitter();
  const scene = {
    input,
    events,
    game: { canvas },
    cameras: { main: { getWorldPoint: (x, y) => ({ x: x / 2 + 30, y: y / 2 + 10 }) } },
  };
  const commands = [];
  const read = bindSceneInput(scene, (x, y) => commands.push([x, y]));
  return { keys, canvas, input, events, commands, read };
}

test('combines WASD and arrows without doubling speed and cancels opposing keys', () => {
  const f = fixture();
  f.keys.d.isDown = f.keys.right.isDown = f.keys.w.isDown = true;
  assert.deepEqual(f.read().direction, [1, -1]);
  f.keys.left.isDown = true;
  assert.deepEqual(f.read().direction, [0, -1]);
});

test('mouse and touch use camera world coordinates and focus the game; right click is ignored', () => {
  const f = fixture();
  document.activeElement = {};
  f.input.emit('pointerdown', {
    x: 400,
    y: 300,

    leftButtonDown: () => true,
  });
  assert.deepEqual(f.commands, [[230, 160]]);
  assert.equal(document.activeElement, f.canvas);
  f.input.emit('pointerdown', {
    x: 800,
    y: 500,

    leftButtonDown: () => false,
  });
  assert.equal(f.commands.length, 1);
});

test('clears held keys on focus loss and rejects queued keys while a form has focus', () => {
  const f = fixture();
  f.keys.d.isDown = true;
  f.canvas.dispatchEvent(new Event('blur'));
  assert.deepEqual(f.read().direction, [0, 0]);
  document.activeElement = {};
  f.keys.right.isDown = true;
  assert.deepEqual(f.read().direction, [0, 0]);
  f.canvas.focus();
  assert.deepEqual(f.read().direction, [0, 0]);
});

test('scene shutdown releases the pointer and focus listeners', () => {
  const f = fixture();
  f.events.emit('shutdown');
  f.input.emit('pointerdown', {
    x: 400,
    y: 300,

    leftButtonDown: () => true,
  });
  assert.deepEqual(f.commands, []);
  f.keys.d.isDown = true;
  f.canvas.dispatchEvent(new Event('blur'));
  assert.equal(f.keys.d.isDown, true);
});
