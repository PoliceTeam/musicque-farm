import { items } from '@chibi-town/character-core/item-catalog';
import { equippedPose, layoutAvatar } from '@chibi-town/character-core/layout-logic';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { auraTagColor, hatLights } from '@/features/character/_utils/effect-logic';
import { Farm } from '@/features/farm/rendering/farm-view';
import { layoutPet } from '@/game/movement/pet-follow-logic';
import type { TownState } from '@/game/movement/town-logic';
import { TOWN_CHARACTER_SCALE } from '@/game/movement/town-map';
import { drawAvatarLabel } from '@/game/rendering/avatar-label';
import { PieceCache } from '@/game/rendering/canvas-renderer';
import { paintEmitter, paintHatLights } from '@/game/rendering/town-effects-view';

/** World view submits native sprites, scenery and effects to the selected engine. */
export class TownView {
  readonly pieces = new PieceCache(sheet);
  private readonly scenery: ReturnType<Farm['surfaces']>;

  constructor(
    private readonly state: TownState,
    scenery?: ReturnType<Farm['surfaces']>,
    private readonly characterScale = TOWN_CHARACTER_SCALE,
    private readonly overlay?: (renderer: CharacterRenderer) => void,
    private readonly avatarLabel = (level: number, name: string) => `LV ${level} ${name}`,
  ) {
    this.scenery = scenery ?? new Farm().surfaces();
  }

  draw(renderer: CharacterRenderer, now: number) {
    const scale = this.characterScale;
    renderer.beginFrame();
    const ground = this.scenery[0];
    renderer.surface(ground.key, ground.source, ground.x, ground.y, ground.width, ground.height);
    const scene: { y: number; draw(): void }[] = this.scenery.slice(1).map((s) => ({
      y: s.depth,

      draw: () => renderer.surface(s.key, s.source, s.x, s.y, s.width, s.height),
    }));
    for (const w of this.state.residents) {
      const x = Math.round(w.x);
      const y = Math.round(w.y);
      const ops = layoutAvatar(items, sheet, w.avatar.visibleEquip(items), w.avatar.pose, w.avatar.mirror, now);
      scene.push({
        y,

        draw: () => {
          renderer.rectangle(x - 13 * scale, y - scale, 26 * scale, 2 * scale, 0x1e320f, 0.35);
          if (w.fx?.gearAura) renderer.aura(`${w.name}-gear-back`, x, y, 19 * scale, 5 * scale, w.fx.gearAura, 'back');
          renderer.drawPieces('character', sheet, ops, x, y, scale);
          if (w.fx?.gearAura)
            renderer.aura(`${w.name}-gear-front`, x, y, 19 * scale, 5 * scale, w.fx.gearAura, 'front');
          if (w.fx?.gear) paintEmitter(renderer, `${w.name}-gear`, w.fx.gear, w.x, w.y, w.avatar.action === 1, scale);
          if (w.fx?.hat) paintEmitter(renderer, `${w.name}-hat`, w.fx.hat, w.x, w.y, w.avatar.action === 1, scale);
          const hat = w.avatar.equip.map((e) => items[e.item]).find((item) => item?.slot === 'hat');
          if (hat) {
            const { piece, dx, dy } = equippedPose(items, w.avatar.equip, hat, w.avatar.pose);
            const { width, height } = sheet.pieces[piece];
            paintHatLights(renderer, hatLights(hat.id, dx, dy, width, height, w.avatar.mirror, now), x, y, scale);
          }
        },
      });
      const pet = w.pet;
      if (pet) {
        const px = Math.round(pet.x);
        const py = Math.round(pet.y);
        scene.push({
          y: py,

          draw: () => {
            // A flyer's shadow stays on the ground, smaller and fainter.
            const flying = Boolean(pet.def.fly);
            renderer.rectangle(
              px - (flying ? 5 : 8) * scale,
              py - scale,
              (flying ? 10 : 16) * scale,
              2 * scale,
              0x1e320f,
              flying ? 0.2 : 0.3,
            );
            if (pet.def.aura) renderer.aura(`${w.name}-pet-back`, px, py, 12 * scale, 3 * scale, pet.def.aura, 'back');
            renderer.drawPieces('pet', petSheet, [layoutPet(pet, petSheet)], px, py, scale);
            if (pet.def.aura)
              renderer.aura(`${w.name}-pet-front`, px, py, 12 * scale, 3 * scale, pet.def.aura, 'front');
            if (w.fx?.pet) paintEmitter(renderer, `${w.name}-pet`, w.fx.pet, pet.x, pet.y, pet.moving, scale);
          },
        });
      }
    }
    // Lower on screen = nearer: draw in baseline order so the row in front covers the feet.
    scene
      .sort((a, b) => a.y - b.y)
      .forEach((d) => {
        d.draw();
      });
    if (this.state.marker) renderer.marker('destination', this.state.marker[0], this.state.marker[1]);
    for (const w of [...this.state.residents].sort((a, b) => a.y - b.y))
      drawAvatarLabel(
        renderer,
        this.avatarLabel(w.level, w.name),
        w.avatar,
        w.x,
        w.y,
        scale,
        w.player,
        auraTagColor(w.fx?.aura ?? 0, now),
      );
    this.overlay?.(renderer);
    renderer.endFrame();
  }
}
