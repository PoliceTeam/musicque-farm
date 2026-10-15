import { AvatarState } from '@chibi-town/character-core/animation-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { items, type PetDef } from '@chibi-town/character-core/item-catalog';
import { equippedPose } from '@chibi-town/character-core/layout-logic';
import { randomOutfit, toEquip, wornPet } from '@chibi-town/character-core/outfit-logic';
import { petSheet, sheet } from '@/assets/asset-catalog';
import {
  type Area,
  type Aura,
  type EffectKind,
  GEAR_AREA,
  hatAreas,
  isEffect,
  mirrorAreas,
  strongest,
} from '@/features/character/_utils/effect-logic';
import { clampTo, stepWalker, type Walker } from '@/game/movement/movement-logic';
import { layoutPet, makePet, type Pet, stepPet, TRAIL, type Trail } from '@/game/movement/pet-follow-logic';
import { WALK_AREA } from '@/game/movement/town-map';
import { PLAYER_SPEED } from '@/game/runtime/game-config';

/** Special effects of a resident's top-rank gear and pet: specks around the wings / pet and a ring. */
export type EffectSource = { kind: EffectKind; area: Area | Area[] };
type Fx = { gear?: EffectSource; hat?: EffectSource; pet?: EffectSource; aura: Aura; gearAura: Aura };
export type Resident = Walker & { pet?: Pet; fx?: Fx };

function fxFor(w: Resident): Fx {
  const equipped = w.avatar.equip.map((e) => items[e.item]).filter(Boolean);
  const gear = strongest(equipped.filter((item) => item.slot !== 'hat'));
  const hat = equipped.find((item) => item.slot === 'hat');
  const pet = w.pet ? strongest([w.pet.def]) : { aura: 0 as Aura };
  return {
    gear: gear.effect ? { kind: gear.effect, area: GEAR_AREA } : undefined,
    hat: isEffect(hat?.effect) ? { kind: hat.effect, area: [] } : undefined,
    pet: w.pet && isEffect(w.pet.def.effect) ? { kind: w.pet.def.effect, area: GEAR_AREA } : undefined,
    aura: Math.max(gear.aura, pet.aura) as Aura,
    gearAura: gear.aura,
  };
}

/** Bigger (evolved) pets keep further back so they don't overlap their owner. */
function trailFor(def: PetDef): Trail {
  return { ...TRAIL, behind: Math.max(TRAIL.behind, Math.ceil(petSheet.pieces[def.piece].width / 2) + 16) };
}

function petFor(outfit: Outfit, w: Walker): Pet | undefined {
  const def = wornPet(outfit);
  return def ? makePet(def, w.x, w.y, w.avatar.mirror, trailFor(def)) : undefined;
}

function npc(name: string, level: number, x: number, y: number): Resident {
  const outfit = randomOutfit();
  const w: Resident = {
    name,
    level,
    x,
    y,
    speed: 22 + Math.random() * 12,
    target: null,
    wait: 1 + Math.random() * 2,
    avatar: new AvatarState(toEquip(outfit)),
  };
  w.pet = petFor(outfit, w);
  w.fx = fxFor(w);
  return w;
}

/** Mutable simulation data. Rendering and input adapters receive this object. */
export type TownState = { player: Resident; residents: Resident[]; marker: [number, number] | null };

export function createTownState(outfit: Outfit, identity = { name: 'Bé Chibi', level: 1 }): TownState {
  const player: Resident = {
    name: identity.name,
    level: identity.level,
    x: 150,
    y: 146,
    speed: PLAYER_SPEED,
    target: null,
    wait: 0,
    avatar: new AvatarState(toEquip(outfit)),
    player: true,
  };
  player.pet = petFor(outfit, player);
  player.fx = fxFor(player);
  const residents: Resident[] = [
    player,
    npc('Tí', 7, 300, 196),
    npc('Mun', 3, 90, 280),
    npc('Hoa', 12, 380, 140),
    npc('Bin', 5, 230, 172),
    npc('Su', 9, 420, 270),
  ];

  return { player, residents, marker: null };
}

export function moveTownTo(state: TownState, x: number, y: number) {
  const point = clampTo(WALK_AREA, x, y);
  state.player.target = point;
  state.marker = [Math.round(point[0]), Math.round(point[1])];
}

export function tickTown(state: TownState) {
  state.residents.forEach((w) => {
    w.avatar.step();
  });
}

export function setTownOutfit(state: TownState, outfit: Outfit) {
  state.player.avatar.equip = toEquip(outfit);
  const def = wornPet(outfit);
  if (!def) state.player.pet = undefined;
  else if (state.player.pet) {
    state.player.pet.def = def;
    state.player.pet.trail = trailFor(def);
  } else state.player.pet = petFor(outfit, state.player);
  state.player.fx = fxFor(state.player);
}

export function updateTown(state: TownState, dt: number, direction: [number, number] = [0, 0]) {
  for (const w of state.residents) {
    const arrived = stepWalker(w, dt, WALK_AREA, w.player ? direction : undefined);
    if (w.player && (arrived || !w.target)) state.marker = null;
    if (w.pet) stepPet(w.pet, { x: w.x, y: w.y, speed: w.speed, mirror: w.avatar.mirror }, dt);
  }
  updateTownEffects(state);
}

export function updateTownEffects(state: TownState) {
  for (const w of state.residents) {
    const fx = w.fx;
    if (fx?.hat) {
      const hat = w.avatar.equip.map((e) => items[e.item]).find((item) => item?.slot === 'hat')!;
      const { piece, dx, dy } = equippedPose(items, w.avatar.equip, hat, w.avatar.pose);
      const size = sheet.pieces[piece];
      fx.hat.area = hatAreas(dx, dy, size.width, size.height, w.avatar.mirror);
    }
    if (fx?.gear) {
      fx.gear.area = mirrorAreas(GEAR_AREA, w.avatar.mirror);
    }
    if (fx?.pet && w.pet) {
      const op = layoutPet(w.pet, petSheet);
      const size = petSheet.pieces[op.piece];
      fx.pet.area = { x0: op.x, x1: op.x + size.width, y0: op.y, y1: op.y + size.height * 0.7 };
    }
  }
}
