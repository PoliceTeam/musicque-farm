import type { CharacterRenderer, RendererInput, RendererProvider } from '@chibi-town/render-contracts/renderer-types';
import Phaser from 'phaser';
import { CharacterView } from './character-view.js';
import { bindSceneInput } from './scene-input-handler.js';

/** Phaser objects and lifecycle are contained inside this adapter. */
export const createPhaserProvider: RendererProvider = (options) => {
  let view: CharacterView | undefined;
  let destroyed = false;
  let active = true;
  let scene: Phaser.Scene | undefined;
  let readInput: (() => RendererInput) | undefined;
  let ticker: Phaser.Time.TimerEvent | undefined;
  let kind = 'phaser';
  const density = options.renderScale ?? 1;
  class RenderScene extends Phaser.Scene {
    constructor() {
      super('render-scene');
    }

    create() {
      if (destroyed) return;
      this.cameras.main.setOrigin(0, 0).setZoom(density);
      scene = this;
      if (options.camera) {
        const camera = this.cameras.main.setOrigin(0.5, 0.5);
        camera.setBounds(0, 0, options.camera.worldWidth, options.camera.worldHeight);

        const fitCamera = () => {
          camera.setZoom(
            Math.max(
              options.camera!.zoom ?? 1,
              this.scale.width / options.camera!.worldWidth,
              this.scale.height / options.camera!.worldHeight,
            ),
          );
          camera.centerOn(...options.camera!.target());
        };

        fitCamera();
        this.scale.on(Phaser.Scale.Events.RESIZE, fitCamera);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, fitCamera));
      }
      view = new CharacterView(this, options.smoothSurfaces);
      if (options.fixedStep) {
        ticker = this.time.addEvent({
          delay: options.fixedStep.interval,
          loop: true,

          callback: () => {
            if (!destroyed && active) options.fixedStep?.onTick();
          },
        });
      }
      if (options.input) {
        this.game.canvas.tabIndex = 0;
        this.game.canvas.setAttribute(
          'aria-label',
          'Khung game: click để đi, dùng phím mũi tên hoặc WASD để di chuyển',
        );
        readInput = bindSceneInput(this, (x, y) => {
          if (!destroyed && active) options.input?.onPointerDown(x, y);
        });
      }
      kind = this.game.renderer.type === Phaser.WEBGL ? 'phaser-webgl' : 'phaser-canvas';
      options.onReady?.(renderer);
      if (!active) this.scene.pause();
    }

    update(_time: number, delta: number) {
      if (!destroyed && active && view) {
        if (readInput) options.onFrame(renderer, performance.now(), delta, readInput());
        else options.onFrame(renderer, performance.now(), delta);
        if (options.camera) this.cameras.main.centerOn(...options.camera.target());
      }
    }
  }
  const renderer: CharacterRenderer = {
    get kind() {
      return kind;
    },

    clientPoint(x, y) {
      if (destroyed || !scene) return undefined;
      const camera = scene.cameras.main;
      const rect = scene.game.canvas.getBoundingClientRect();
      const point = camera.matrixCombined.transformPoint(x, y);
      return [
        rect.left + (point.x * rect.width) / scene.scale.width,
        rect.top + (point.y * rect.height) / scene.scale.height,
      ];
    },

    beginFrame() {
      if (!destroyed) view?.beginFrame();
    },

    drawPieces(...args) {
      if (!destroyed) view?.drawPieces(...args);
    },

    rectangle(...args) {
      if (!destroyed) view?.rectangle(...args);
    },

    surface(...args) {
      if (!destroyed) view?.surface(...args);
    },

    label(...args) {
      if (!destroyed) view?.label(...args);
    },

    particles(...args) {
      if (!destroyed) view?.particles(...args);
    },

    aura(...args) {
      if (!destroyed) view?.aura(...args);
    },

    marker(...args) {
      if (!destroyed) view?.marker(...args);
    },

    endFrame() {
      if (!destroyed) view?.endFrame();
    },

    resize(width, height, zoom) {
      if (destroyed) return;
      game.scale.resize(width * density, height * density);
      game.scale.setZoom(zoom / density);
    },

    setActive(next) {
      if (destroyed || active === next) return;
      active = next;
      if (!active && ticker) ticker.elapsed = 0;
      if (scene) {
        if (active) scene.scene.resume();
        else scene.scene.pause();
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      resizeObserver?.disconnect();
      view = undefined;
      scene = undefined;
      readInput = undefined;
      ticker = undefined;
      game.destroy(true);
    },
  };
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    scale: {
      mode: options.fillParent ? Phaser.Scale.RESIZE : options.fitParent ? Phaser.Scale.FIT : Phaser.Scale.NONE,
    },
    width: options.width * density,
    height: options.height * density,
    zoom: options.zoom / density,
    backgroundColor: options.backgroundColor,
    pixelArt: true,
    roundPixels: true,
    scene: [new RenderScene()],
    audio: { noAudio: true },
    input: {
      keyboard: options.input ? { target: options.parent } : false,
      mouse: Boolean(options.input),
      touch: Boolean(options.input),
      gamepad: false,
    },
    banner: false,
  });
  const resizeObserver =
    options.fitParent || options.fillParent
      ? new ResizeObserver(() => {
          if (!destroyed) game.scale.refresh();
        })
      : undefined;
  resizeObserver?.observe(options.parent);
  return renderer;
};
