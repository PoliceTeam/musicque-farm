import type { DrawOp } from '@chibi-town/character-core/character-types';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';
import { spritePixels, spriteTextureKey } from '@chibi-town/render-contracts/sprite-pixels';
import type Phaser from 'phaser';

/** Bake existing editable pixel assets once; Phaser draws cached GPU textures after that. */
export class SpriteTextureFactory {
  private readonly cache = new Map<string, string>();
  private readonly used = new Set<string>();
  private serial = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame() {
    this.used.clear();
  }

  get(sheetName: string, sheet: SpriteSheet, op: DrawOp): string {
    const content = spriteTextureKey(sheetName, op);
    this.used.add(content);
    let key = this.cache.get(content);
    if (key) return key;
    const pixels = spritePixels(sheet, op);
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas.getContext('2d')!.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
    key = `character-piece-${this.serial++}`;
    if (!this.scene.textures.addCanvas(key, canvas)) throw new Error(`cannot create texture ${key}`);
    this.cache.set(content, key);
    return key;
  }

  endFrame() {
    // Random outfits must not accumulate GPU textures indefinitely. Never evict visible pieces.
    if (this.cache.size <= 512) return;
    for (const [content, key] of this.cache) {
      if (this.used.has(content)) continue;
      this.scene.textures.remove(key);
      this.cache.delete(content);
      if (this.cache.size <= 512) break;
    }
  }
}
