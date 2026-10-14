import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip, wornPet } from '@chibi-town/character-core/outfit-logic';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { paintEmitter, paintHatLights } from '@/devtools/town/rendering/town-effects-view';
import { type CharacterLabState, equippedHat } from '@/features/character/_utils/character-lab-logic';
import { hatAreas, hatLights, isEffect } from '@/features/character/_utils/effect-logic';
import { layoutPet, type Pet, TRAIL } from '@/game/movement/pet-follow-logic';

export function createCharacterLabView(app: HTMLElement, state: CharacterLabState) {
  const shadow = (renderer: CharacterRenderer, x: number, y: number, width = 26) =>
    renderer.rectangle(x - width / 2, y - 1, width, 2, 0, 0.25);

  const avatar = (
    renderer: CharacterRenderer,
    hero: typeof state.hero,
    x: number,
    y: number,
    now: number,
    key: string,
  ) => {
    renderer.drawPieces(
      'character',
      sheet,
      layoutAvatar(items, sheet, hero.visibleEquip(items), hero.pose, hero.mirror, now),
      x,
      y,
    );
    const hat = equippedHat(hero);
    if (!hat) return;
    if (isEffect(hat.hat.effect))
      paintEmitter(
        renderer,
        key,
        { kind: hat.hat.effect, area: hatAreas(hat.dx, hat.dy, hat.width, hat.height, hero.mirror) },
        x,
        y,
        hero.action === 1,
      );
    paintHatLights(renderer, hatLights(hat.hat.id, hat.dx, hat.dy, hat.width, hat.height, hero.mirror, now), x, y);
  };

  const parents = Object.fromEntries(
    ['big', 'parts', 'poses', 'farm'].map((id) => [id, app.querySelector<HTMLElement>(`#${id}`)!]),
  );
  let partsHeight = 0;
  let revision = 0,
    partsRevision = -1,
    posesRevision = -1;
  return {
    parents,

    sync() {
      revision++;
    },

    drawBig(renderer: CharacterRenderer, now: number) {
      renderer.beginFrame();
      shadow(renderer, 52, 114, 30);
      avatar(renderer, state.hero, 52, 114, now, 'hero-hat');
      const def = wornPet(state.outfit);
      if (def) {
        const pet: Pet = {
          def,
          trail: TRAIL,
          following: false,
          x: 0,
          y: 0,
          mirror: state.hero.mirror,
          moving: state.heroWalking,
          hopTime: now / 1000,
          time: now / 1000,
        };
        const px = state.hero.mirror ? 52 + TRAIL.behind : 52 - TRAIL.behind;
        shadow(renderer, px, 115, 16);
        renderer.drawPieces('pet', petSheet, [layoutPet(pet, petSheet)], px, 115);
      }
      renderer.endFrame();
    },

    drawParts(renderer: CharacterRenderer) {
      if (partsRevision === revision) return;
      partsRevision = revision;
      const ops = layoutAvatar(items, sheet, toEquip(state.outfit), 0, false);
      const height = Math.max(1, Math.ceil(ops.length / 6)) * 124;
      if (height !== partsHeight) {
        partsHeight = height;
        renderer.resize(504, height, 2);
      }
      renderer.beginFrame();
      ops.forEach((op, i) => {
        const x = (i % 6) * 84;
        const y = Math.floor(i / 6) * 124;
        renderer.rectangle(x + 1, y + 1, 82, 122, 0xffffff, 0.05);
        renderer.drawPieces('character', sheet, [op], x + 42, y + 110);
        renderer.rectangle(x + 42, y + 110, 1, 1, 0xffcc33);
        const text =
          Object.values(items).find((item) => item.poses.some((p) => p.piece === op.piece))?.label ?? op.piece;
        renderer.label(text, x + 42, y + 122, '#cfd3e6');
      });
      renderer.endFrame();
    },

    drawPoses(renderer: CharacterRenderer) {
      if (posesRevision === revision) return;
      posesRevision = revision;
      renderer.beginFrame();
      const cells: [number, boolean][] = [
        [0, false],
        [1, false],
        [2, false],
        [3, false],
        [0, true],
        [2, true],
        [3, true],
      ];
      cells.forEach(([pose, mirror], i) => {
        shadow(renderer, i * 84 + 42, 112);
        renderer.drawPieces(
          'character',
          sheet,
          layoutAvatar(items, sheet, toEquip(state.outfit), pose, mirror),
          i * 84 + 42,
          112,
        );
      });
      renderer.endFrame();
    },

    drawFarm(renderer: CharacterRenderer, now: number) {
      renderer.beginFrame();
      for (let y = 4; y < 150; y += 9)
        for (let x = (y * 7) % 13; x < 480; x += 13) renderer.rectangle(x, y, 3, 1, 0x6aa54b);
      const scene: { y: number; draw(): void }[] = [];
      state.residents.forEach((resident, i) => {
        const x = Math.round(resident.x),
          y = Math.round(resident.y);
        scene.push({
          y,

          draw: () => {
            shadow(renderer, x, y, 24);
            avatar(renderer, resident.avatar, x, y, now, `resident-${i}-hat`);
          },
        });
        const pet = resident.pet;
        if (pet)
          scene.push({
            y: pet.y,

            draw: () => {
              const px = Math.round(pet.x),
                py = Math.round(pet.y);
              shadow(renderer, px, py, 16);
              renderer.drawPieces('pet', petSheet, [layoutPet(pet, petSheet)], px, py);
            },
          });
      });
      scene
        .sort((a, b) => a.y - b.y)
        .forEach((entry) => {
          entry.draw();
        });
      renderer.endFrame();
    },
  };
}
