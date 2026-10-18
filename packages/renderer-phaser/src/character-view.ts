import type { DrawOp } from '@chibi-town/character-core/character-types';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';
import { MAP_LABEL_STYLE, type ParticleEffect } from '@chibi-town/render-contracts/renderer-types';
import Phaser from 'phaser';
import { EffectsView } from './effects-view.js';
import { SpriteTextureFactory } from './sprite-texture-factory.js';

/** Pooled Phaser sprites and ornaments. Reads draw ops; owns no equipment or simulation rules. */
export class CharacterView {
  private readonly effects: EffectsView;
  private readonly factory: SpriteTextureFactory;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly rectangles: Phaser.GameObjects.Rectangle[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly surfaces = new Map<string, string>();
  private readonly labelStyles = new Map<
    Phaser.GameObjects.Text,
    { text: string; color: string; fontSize: number; border?: string }
  >();
  private labelScale: number | undefined;
  private labelCount = 0;
  private imageCount = 0;
  private rectangleCount = 0;
  private order = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly smoothSurfaces = false,
  ) {
    this.effects = new EffectsView(scene);
    this.factory = new SpriteTextureFactory(scene);
  }

  beginFrame() {
    this.imageCount = this.rectangleCount = this.labelCount = this.order = 0;
    this.labelScale = undefined;
    this.factory.beginFrame();
    this.effects.beginFrame();
  }

  drawPieces(sheetName: string, sheet: SpriteSheet, ops: DrawOp[], x: number, y: number, scale = 1) {
    for (const op of ops) {
      const texture = this.factory.get(sheetName, sheet, op);
      let image = this.images[this.imageCount];
      if (!image) {
        image = this.scene.add.image(0, 0, texture).setOrigin(0);
        this.images.push(image);
      }
      image
        .setTexture(texture)
        .setOrigin(0)
        .setRotation(0)
        .setScale(scale)
        .setPosition(x + op.x * scale, y + op.y * scale)
        .setFlipX(op.flip)
        .setDepth(this.order++)
        .setVisible(true);
      this.imageCount++;
    }
  }

  rectangle(x: number, y: number, width: number, height: number, color: number, alpha = 1) {
    let rectangle = this.rectangles[this.rectangleCount];
    if (!rectangle) {
      rectangle = this.scene.add.rectangle(0, 0, 1, 1).setOrigin(0);
      this.rectangles.push(rectangle);
    }
    rectangle
      .setPosition(x, y)
      .setSize(width, height)
      .setFillStyle(color, alpha)
      .setDepth(this.order++)
      .setVisible(true);
    this.rectangleCount++;
  }

  surface(key: string, source: HTMLCanvasElement, x: number, y: number, width: number, height: number, rotation = 0) {
    let texture = this.surfaces.get(key);
    if (!texture) {
      texture = `world-surface-${this.surfaces.size}`;
      const raster = this.scene.textures.addCanvas(texture, source);
      if (!raster) throw new Error(`cannot create surface ${key}`);
      if (this.smoothSurfaces) raster.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.surfaces.set(key, texture);
    }
    let image = this.images[this.imageCount];
    if (!image) {
      image = this.scene.add.image(0, 0, texture).setOrigin(0);
      this.images.push(image);
    }
    image
      .setTexture(texture)
      .setFlipX(false)
      .setDisplaySize(width, height)
      .setOrigin(rotation ? 0.5 : 0)
      .setRotation(rotation)
      .setPosition(rotation ? x + width / 2 : x, rotation ? y + height / 2 : y)
      .setDepth(this.order++)
      .setVisible(true);
    this.imageCount++;
  }

  label(
    text: string,
    x: number,
    y: number,
    color: string,
    border?: string,
    fontSize: number = MAP_LABEL_STYLE.fontSize,
  ) {
    let label = this.labels[this.labelCount];
    if (!label) {
      label = this.scene.add
        .text(0, 0, '', {
          fontFamily: MAP_LABEL_STYLE.fontFamily,
          fontSize: MAP_LABEL_STYLE.fontSize,
          fontStyle: MAP_LABEL_STYLE.fontStyle,
          padding: { left: 2, right: 2, top: 2, bottom: 2 },
        })
        .setOrigin(0.5, 1)
        .setScale(0.5)
        .setStroke(MAP_LABEL_STYLE.stroke, MAP_LABEL_STYLE.strokeWidth)
        .setResolution(MAP_LABEL_STYLE.resolution);
      label.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.labels.push(label);
    }
    // TextStyle.setColor/setShadow rebuild and upload the canvas even if values are unchanged.
    // Only transforms belong on the frame path; cache style per pooled Text object.
    const previous = this.labelStyles.get(label);
    if (!previous || previous.text !== text) label.setText(text);
    if (!previous || previous.fontSize !== fontSize) label.setFontSize(fontSize);
    if (!previous || previous.color !== color) label.setColor(color);
    if (!previous || previous.border !== border)
      label.setShadow(0, 0, border ?? MAP_LABEL_STYLE.stroke, border ? 3 : 0, true, false);
    if (
      !previous ||
      previous.text !== text ||
      previous.fontSize !== fontSize ||
      previous.color !== color ||
      previous.border !== border
    )
      this.labelStyles.set(label, { text, color, fontSize, border });
    if (this.labelScale === undefined) {
      const cssWidth = this.scene.game.canvas.getBoundingClientRect().width;
      this.labelScale = cssWidth > 0 ? this.scene.scale.width / cssWidth / this.scene.cameras.main.zoom : 0.5;
    }
    label
      .setScale(this.labelScale)
      .setPosition(x, y)
      .setDepth(this.order++)
      .setVisible(true);
    this.labelCount++;
  }

  particles(key: string, effect: ParticleEffect) {
    this.effects.particles(key, effect, this.order++);
  }

  aura(key: string, x: number, y: number, rx: number, ry: number, rank: number, part: 'back' | 'front') {
    this.effects.aura(key, x, y, rx, ry, rank, part, this.order++);
  }

  marker(key: string, x: number, y: number) {
    this.effects.marker(key, x, y, this.order++);
  }

  endFrame() {
    this.images.slice(this.imageCount).forEach((image) => {
      image.setVisible(false);
    });
    this.rectangles.slice(this.rectangleCount).forEach((rectangle) => {
      rectangle.setVisible(false);
    });
    this.labels.slice(this.labelCount).forEach((label) => {
      label.setVisible(false);
    });
    this.factory.endFrame();
    this.effects.endFrame();
  }
}
