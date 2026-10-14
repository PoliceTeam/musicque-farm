// A pet that trails behind its owner: walkers hop and step their legs, flyers hover and flap.

import type { DrawOp } from '@chibi-town/character-core/character-types';
import type { PetDef } from '@chibi-town/character-core/item-catalog';
import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';

/**
 * Where the pet stays relative to its owner. `behind`/`below` set the spot; `leash` is how far the
 * pet lets that spot drift before it sets off, so it lags behind and trots to catch up.
 */
export type Trail = { behind: number; below: number; leash: number };

export type Pet = {
  def: PetDef;
  trail: Trail;
  /** True from leaving the leash until it reaches its spot again. */
  following: boolean;
  x: number;
  y: number;
  mirror: boolean;
  moving: boolean;
  /** Seconds spent moving, drives the hop. */
  hopTime: number;
  /** Seconds since the pet appeared, drives hovering and wing flaps (which never stop). */
  time: number;
};

/**
 * The character is about 30px wide, so the pet keeps clear of it, walks a little lower (nearer the
 * camera) and waits until the owner is a few steps ahead before trotting after.
 */
export const TRAIL: Trail = { behind: 30, below: 4, leash: 14 };
const HOP_PERIOD = 0.36; // seconds per hop
const HOP_HEIGHT = 2;
/** Seconds each walk frame shows: four frames make one hop. */
const FRAME_TIME = HOP_PERIOD / 4;
/** Flyers: seconds per wing frame (faster while chasing the owner) and a slow up-down hover. */
const FLAP_TIME = 0.11;
const FLAP_TIME_MOVING = 0.07;
const HOVER_PERIOD = 1.2;
const HOVER_HEIGHT = 2;

export function makePet(def: PetDef, ownerX: number, ownerY: number, ownerMirror: boolean, trail: Trail = TRAIL): Pet {
  const back = ownerMirror ? 1 : -1;
  return {
    def,
    trail,
    following: false,
    x: ownerX + back * trail.behind,
    y: ownerY + trail.below,
    mirror: ownerMirror,
    moving: false,
    hopTime: 0,
    time: 0,
  };
}

export function stepPet(pet: Pet, owner: { x: number; y: number; speed: number; mirror: boolean }, dt: number) {
  pet.time += dt;
  const { behind, below, leash } = pet.trail;
  const back = owner.mirror ? 1 : -1;
  const tx = owner.x + back * behind;
  const ty = owner.y + below;
  const dx = tx - pet.x;
  const dy = ty - pet.y;
  const distance = Math.hypot(dx, dy);
  // Catch up a bit faster than the owner walks, so it never drifts away.
  const step = Math.max(owner.speed * 1.15, 24) * dt;
  if (!pet.following && distance <= Math.max(leash, 1)) {
    // Resting: look at the owner.
    pet.moving = false;
    pet.hopTime = 0;
    if (Math.abs(owner.x - pet.x) > 0.5) pet.mirror = owner.x < pet.x;
    else pet.mirror = owner.mirror;
    return;
  }
  pet.following = true;
  pet.moving = true;
  if (distance <= step) {
    pet.x = tx;
    pet.y = ty;
    pet.following = false;
  } else {
    pet.x += (dx / distance) * step;
    pet.y += (dy / distance) * step;
  }
  if (Math.abs(dx) > 0.5) pet.mirror = dx < 0;
  pet.hopTime += dt;
}

/** Pixels the pet is lifted off the ground this frame: flyers hover at their height, walkers hop. */
export function hopOffset(pet: Pet): number {
  if (pet.def.fly) return pet.def.fly + Math.round(Math.sin((pet.time / HOVER_PERIOD) * Math.PI * 2) * HOVER_HEIGHT);
  if (!pet.moving) return 0;
  const phase = (pet.hopTime % HOP_PERIOD) / HOP_PERIOD;
  return Math.round(Math.sin(phase * Math.PI) * (pet.def.hop ?? HOP_HEIGHT));
}

/** One draw op with the origin at the middle of the pet's feet. */
export function layoutPet(pet: Pet, sheet: SpriteSheet): DrawOp {
  const { walk, flap } = pet.def;
  let name = pet.def.piece;
  if (flap?.length) {
    // Flyers flap all the time, faster while moving.
    name = flap[Math.floor(pet.time / (pet.moving ? FLAP_TIME_MOVING : FLAP_TIME)) % flap.length];
  } else if (pet.moving && walk?.length) {
    // Walkers cycle their walk frames, so the legs take turns.
    name = walk[Math.floor(pet.hopTime / FRAME_TIME) % walk.length];
  }
  const piece = sheet.pieces[name];
  const left = -Math.floor(piece.width / 2);
  return {
    piece: name,
    recolor: pet.def.recolor,
    x: pet.mirror ? -left - piece.width : left,
    y: -piece.height - hopOffset(pet),
    flip: pet.mirror,
  };
}
