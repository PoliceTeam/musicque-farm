import { pets } from '@chibi-town/character-core/item-catalog';
import { describe, expect, it } from 'vitest';
import { petSheet as sheet } from '@/assets/asset-catalog';
import { hopOffset, layoutPet, makePet, stepPet, TRAIL } from '@/game/movement/pet-follow-logic';

const owner = { x: 100, y: 100, speed: 40, mirror: false };

describe('pet', () => {
  it('settles a little behind its owner and faces the same way', () => {
    const pet = makePet(pets.corgi, 60, 120, false);
    for (let i = 0; i < 200; i++) stepPet(pet, owner, 0.05);
    expect(pet.x).toBeCloseTo(owner.x - TRAIL.behind);
    expect(pet.y).toBeCloseTo(owner.y + TRAIL.below);
    expect(pet.moving).toBe(false);
    expect(pet.mirror).toBe(false);
    expect(hopOffset(pet)).toBe(0);
  });

  it('switches to the other side when the owner turns left', () => {
    const pet = makePet(pets.cat, owner.x - TRAIL.behind, owner.y + TRAIL.below, false);
    for (let i = 0; i < 200; i++) stepPet(pet, { ...owner, mirror: true }, 0.05);
    expect(pet.x).toBeCloseTo(owner.x + TRAIL.behind);
    expect(pet.mirror).toBe(true);
  });

  it('hops while catching up', () => {
    const pet = makePet(pets.chick, 0, 100, false);
    const lifts = new Set<number>();
    for (let i = 0; i < 20; i++) {
      stepPet(pet, owner, 0.03);
      lifts.add(hopOffset(pet));
    }
    expect(pet.moving).toBe(true);
    expect(Math.max(...lifts)).toBeGreaterThan(0);
  });

  it('on a leash, waits until the owner is a few steps ahead, then trots after', () => {
    const trail = { behind: 30, below: 4, leash: 14 };
    const pet = makePet(pets.corgi, owner.x, owner.y, false, trail);
    stepPet(pet, { ...owner, x: owner.x + 10 }, 0.05);
    expect(pet.moving).toBe(false);
    stepPet(pet, { ...owner, x: owner.x + 20 }, 0.05);
    expect(pet.moving).toBe(true);
    for (let i = 0; i < 100; i++) stepPet(pet, { ...owner, x: owner.x + 20 }, 0.05);
    expect(pet.x).toBeCloseTo(owner.x + 20 - 30);
    expect(pet.moving).toBe(false);
  });

  it('faces its owner while resting', () => {
    const pet = makePet(pets.cat, owner.x + 35, owner.y, false, { behind: 30, below: 0, leash: 40 }); // lands 5px right of the owner
    stepPet(pet, owner, 0.05);
    expect(pet.mirror).toBe(true);
  });

  it('cycles its walk frames while moving and stands still otherwise', () => {
    const pet = makePet(pets.corgi, 0, 100, false);
    expect(layoutPet(pet, sheet).piece).toBe('pet.corgi');
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      stepPet(pet, owner, 0.03);
      seen.add(layoutPet(pet, sheet).piece);
    }
    expect([...seen].sort()).toEqual([...pets.corgi.walk!].sort().filter((v, i, a) => a.indexOf(v) === i));
  });

  it('a flyer hovers off the ground and flaps its wings even at rest', () => {
    const pet = makePet(pets.dragon, owner.x, owner.y, false);
    const frames = new Set<string>();
    const heights = new Set<number>();
    for (let i = 0; i < 30; i++) {
      stepPet(pet, owner, 0.05);
      frames.add(layoutPet(pet, sheet).piece);
      heights.add(hopOffset(pet));
    }
    expect(pet.moving).toBe(false);
    expect(frames.size).toBeGreaterThan(1);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(pets.dragon.fly! - 2);
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
  });

  it('is laid out standing on its origin, mirrored about it', () => {
    const pet = makePet(pets.corgi, 0, 0, false);
    const piece = sheet.pieces[pets.corgi.piece];
    const right = layoutPet(pet, sheet);
    expect(right.y).toBe(-piece.height);
    pet.mirror = true;
    const left = layoutPet(pet, sheet);
    expect(left.x).toBe(-right.x - piece.width);
    expect(left.flip).toBe(true);
  });
});
