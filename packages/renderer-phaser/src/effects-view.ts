import type { ParticleEffect } from '@chibi-town/render-contracts/renderer-types';
import Phaser from 'phaser';

type Ornament = { graphic: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween; motion: { offset: number } };

/** Native emitters and tweens own visual time, particle lifetime and resource cleanup. */
export class EffectsView {
  private readonly used = new Set<string>();
  private readonly emitters = new Map<
    string,
    { emitter: Phaser.GameObjects.Particles.ParticleEmitter; effect: ParticleEffect; signature: string; rate: number }
  >();
  private readonly ornaments = new Map<string, Ornament>();

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame() {
    this.used.clear();
  }

  particles(key: string, effect: ParticleEffect, depth: number) {
    if (!effect.areas.length) return;
    this.used.add(key);
    const signature = JSON.stringify(effect.style);
    let node = this.emitters.get(key);
    if (node && node.signature !== signature) {
      node.emitter.destroy();
      this.emitters.delete(key);
      node = undefined;
    }
    const rate = effect.style.rate?.[effect.moving ? 1 : 0] ?? (effect.moving ? 24 : 10);
    if (!node) {
      if (!this.scene.textures.exists('effect-pixel')) {
        const graphic = this.scene.make.graphics({});
        graphic.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('effect-pixel', 1, 1);
        graphic.destroy();
      }
      const style = effect.style;
      const source = {
        getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
          const current = this.emitters.get(key)?.effect ?? effect;
          const area = Phaser.Utils.Array.GetRandom(current.areas);
          point.x = current.x + Phaser.Math.FloatBetween(area.x0, area.x1);
          point.y = current.y + Phaser.Math.FloatBetween(area.y0, area.y1);
          return point;
        },
      };
      const emitter = this.scene.add.particles(0, 0, 'effect-pixel', {
        lifespan: { min: style.life[0] * 1000, max: style.life[1] * 1000 },
        speedX: { min: -style.vx, max: style.vx },
        speedY: { min: style.vy * 0.6, max: style.vy * 1.4 },
        accelerationX: { onUpdate: (_particle, _key, t) => Math.cos(t * 6) * style.sway * 6 },
        gravityY: style.gravity,
        scale: { onEmit: () => Phaser.Math.FloatBetween(style.size[0], style.size[1]) },
        tint: style.colors.map((color) => Phaser.Display.Color.HexStringToColor(color).color),
        alpha: {
          onUpdate: (particle, _key, t) => (t > 0.75 && Math.floor((particle.lifeCurrent / 1000) * 20) % 2 ? 0 : 1),
        },
        frequency: 1000 / rate,
        maxParticles: 32,
        emitZone: { type: 'random', source },
      });
      node = { emitter, effect, signature, rate };
      this.emitters.set(key, node);
    }
    node.effect = effect;
    if (node.rate !== rate) {
      node.emitter.setFrequency(1000 / rate);
      node.rate = rate;
    }
    node.emitter.setDepth(depth);
  }

  private ornament(key: string, marker: boolean) {
    this.used.add(key);
    let node = this.ornaments.get(key);
    if (!node) {
      const graphic = this.scene.add.graphics();
      if (marker) {
        graphic.fillStyle(0x8a5a00).fillRect(-3, 0, 7, 1).fillRect(0, 3, 1, 1);
        graphic.fillStyle(0xffd43b).fillRect(-2, 1, 5, 1).fillRect(-1, 2, 3, 1);
      } else graphic.alpha = 0.5;
      const motion = { offset: 0 };
      const tween = this.scene.tweens.add(
        marker
          ? { targets: motion, offset: 1, duration: 200, ease: 'Stepped', easeParams: [1], yoyo: true, repeat: -1 }
          : { targets: graphic, alpha: 1, duration: 817, ease: 'Sine.InOut', yoyo: true, repeat: -1 },
      );
      node = { graphic, tween, motion };
      this.ornaments.set(key, node);
    }
    return node;
  }

  marker(key: string, x: number, y: number, depth: number) {
    const node = this.ornament(key, true);
    // Keep the tween offset separate from the world position updated each frame.
    node.graphic.x = x;
    node.graphic.setDepth(depth);
    node.graphic.setScrollFactor(1);
    node.graphic.setPosition(x, y - 14 + Math.round(node.motion.offset));
  }

  aura(key: string, x: number, y: number, rx: number, ry: number, rank: number, part: 'back' | 'front', depth: number) {
    const node = this.ornament(key, false);
    const color =
      rank === 3
        ? Phaser.Display.Color.HSLToColor(((this.scene.time.now / 12) % 360) / 360, 0.9, 0.62).color
        : rank === 2
          ? 0xffb000
          : 0xb46bff;
    node.graphic.clear().fillStyle(color).setPosition(x, y).setDepth(depth);
    for (let dx = -rx; dx <= rx; dx++) {
      const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (rx * rx))));
      node.graphic.fillRect(dx, (part === 'back' ? -dy : dy) - 1, 1, 2);
    }
  }

  endFrame() {
    for (const [key, node] of this.emitters)
      if (!this.used.has(key)) {
        node.emitter.destroy();
        this.emitters.delete(key);
      }
    for (const [key, node] of this.ornaments)
      if (!this.used.has(key)) {
        node.tween.remove();
        node.graphic.destroy();
        this.ornaments.delete(key);
      }
  }
}
