import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import type { Outfit as PixelOutfit } from '@chibi-town/character-core/character-types';
import { items as pixelItems } from '@chibi-town/character-core/item-catalog';
import { equippedPose } from '@chibi-town/character-core/layout-logic';
import {
  defaultOutfit as defaultPixelOutfit,
  normalizeOutfitLevels,
  toEquip as pixelEquip,
  randomOutfit,
  sanitizeOutfit,
  wornPet,
} from '@chibi-town/character-core/outfit-logic';
import { sheet as pixelSheet } from '@/assets/asset-catalog';
import { makePet, type Pet, TRAIL as PIXEL_TRAIL, stepPet } from '@/game/movement/pet-follow-logic';
export const FW = 480;
export const FH = 150;
type Resident = {
  x: number;
  y: number;
  dir: number;
  speed: number;
  wait: number;
  avatar: AvatarState;
  player?: boolean;
  outfit?: PixelOutfit;
  pet?: Pet;
};

/** Mutable Lab data; simulation functions explicitly receive the state they update. */
export type CharacterLabState = {
  outfit: PixelOutfit;
  hero: AvatarState;
  residents: Resident[];
  heroWalking: boolean;
};

export function createCharacterLabState(): CharacterLabState {
  const outfit = { ...defaultPixelOutfit };
  const hero = new AvatarState(pixelEquip(outfit));
  const residents: Resident[] = [
    { x: 80, y: 138, dir: 1, speed: 26, wait: 0, avatar: hero, player: true },
    ...Array.from({ length: 5 }, (_, i) => {
      const outfit = randomOutfit();
      return {
        x: 60 + i * 80,
        y: 100 + (i % 3) * 18,
        dir: i % 2 ? -1 : 1,
        speed: 18 + Math.random() * 14,
        wait: Math.random() * 2,
        avatar: new AvatarState(pixelEquip(outfit)),
        outfit,
      };
    }),
  ];
  residents.forEach((r) => {
    r.outfit && syncPet(r, r.outfit);
  });
  return { outfit, hero, residents, heroWalking: false };
}

export function equippedHat(avatar: AvatarState) {
  const hat = avatar.equip.map((e) => pixelItems[e.item]).find((i) => i?.slot === 'hat');
  if (!hat) return;
  const { piece, dx, dy } = equippedPose(pixelItems, avatar.equip, hat, avatar.pose);
  return { hat, dx, dy, ...pixelSheet.pieces[piece] };
}

function syncPet(r: Resident, o: PixelOutfit) {
  const def = wornPet(o);
  if (!def) r.pet = undefined;
  else if (r.pet) r.pet.def = def;
  else r.pet = makePet(def, r.x, r.y, r.dir < 0, PIXEL_TRAIL);
}

function stepFarm(state: CharacterLabState, dt: number) {
  for (const r of state.residents) {
    if (r.player && !state.heroWalking) {
      r.avatar.setAction(Action.Stand);
      continue;
    }
    if (r.wait > 0) {
      r.wait -= dt;
      r.avatar.setAction(Action.Stand);
      continue;
    }
    r.avatar.setAction(Action.Walk);
    r.x += r.dir * r.speed * dt;
    if (r.x < 24 || r.x > FW - 24) {
      r.dir = -r.dir;
      r.x = Math.max(24, Math.min(FW - 24, r.x));
      if (!r.player) r.wait = 0.5 + Math.random() * 2;
    }
    r.avatar.mirror = r.dir < 0;
  }
  for (const r of state.residents)
    if (r.pet) stepPet(r.pet, { x: r.x, y: r.y, speed: r.speed, mirror: r.avatar.mirror }, dt);
}

export function setCharacterLabOutfit(state: CharacterLabState, next: PixelOutfit) {
  const genderChanged = next.gender !== state.outfit.gender;
  state.outfit = normalizeOutfitLevels(sanitizeOutfit(next));
  if (genderChanged)
    for (const resident of state.residents.filter((r) => !r.player)) {
      resident.outfit = randomOutfit(undefined, state.outfit.gender);
      resident.avatar.equip = pixelEquip(resident.outfit);
      syncPet(resident, resident.outfit);
    }
  state.hero.equip = pixelEquip(state.outfit);
  syncPet(state.residents[0], state.outfit);
}

export function flipCharacterLab(state: CharacterLabState) {
  state.residents[0].dir *= -1;
  state.hero.mirror = !state.hero.mirror;
}

export function updateCharacterLab(state: CharacterLabState, dt: number) {
  stepFarm(state, dt);
  if (!state.heroWalking) state.hero.mirror = state.residents[0].dir < 0;
}

export function tickCharacterLab(state: CharacterLabState) {
  state.residents.forEach((r) => {
    r.avatar.step();
  });
}
