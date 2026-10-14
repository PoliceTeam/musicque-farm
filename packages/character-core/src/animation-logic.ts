// Avatar model ported from the Avatar J2ME client (github.com/itdat/avatar-j2me, avatar/hn.java,
// fa.java, fxClass.java, ke.java). See docs/architecture.md for the mapping.
//
// A character is a list of equipped items. Each item has a layer (J2ME `ld.j`: draw order and slot)
// and POSE_COUNT poses; a pose names a sprite piece and its offset from the character origin, which
// sits between the feet on the ground line. Pure logic only: rendering lives in game/rendering/ and game/entities/.
import type { Equip, ItemDef } from './character-types.js';

export const POSE_COUNT = 15;

/** Action states: rows of POSE_TABLE (J2ME `gx.H`). */
export const Action = { Stand: 0, Walk: 1 } as const;

/**
 * Action state × tick counter (0..9) → pose index, after J2ME `hn.aN`.
 * Standing alternates poses 0/1, five ticks each. Walking differs from J2ME (which alternates 0/2):
 * stand, step with one leg (2), stand, step with the other (3), so the legs take turns instead of
 * one leg doing all the stepping. Rows 2..14 hold action poses.
 */
export const POSE_TABLE: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 2, 2, 2, 0, 0, 3, 3, 3],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  [7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
  [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  [11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
  [13, 13, 13, 13, 13, 13, 13, 13, -2, 13],
  [14, 14, 14, 14, 14, 14, 14, 14, 14, 14],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
];
export const TICKS_PER_CYCLE = 10;

export function poseFor(action: number, tick: number): number {
  const pose = POSE_TABLE[action]?.[tick % TICKS_PER_CYCLE] ?? 0;
  return pose < 0 ? 0 : pose;
}

/** Animation state of one avatar, advanced in J2ME ticks. */
export class AvatarState {
  action: number = Action.Stand;
  tick = 0;
  mirror = false;
  private blinkTicks = 0;
  private nextBlink: number;

  constructor(
    public equip: Equip[],
    private random: () => number = Math.random,
  ) {
    this.nextBlink = this.blinkDelay();
  }

  get pose(): number {
    return poseFor(this.action, this.tick);
  }

  get blinking(): boolean {
    return this.blinkTicks > 0;
  }

  setAction(action: number) {
    if (action === this.action) return;
    this.action = action;
    // Start a walk on the first step pose at the next tick instead of standing still first.
    this.tick = action === Action.Walk ? 1 : 0;
  }

  step() {
    this.tick = (this.tick + 1) % TICKS_PER_CYCLE;
    // Eyes swap to the blink item for two ticks now and then, like hn swaps its eye group.
    if (this.blinkTicks > 0) this.blinkTicks--;
    else if (--this.nextBlink <= 0) {
      this.blinkTicks = 2;
      this.nextBlink = this.blinkDelay();
    }
  }

  /** Equipment as drawn this tick (with the blink swap applied). */
  visibleEquip(items: Record<string, ItemDef>, blinkItem = 'eyes.blink'): Equip[] {
    if (!this.blinking) return this.equip;
    return this.equip.map((e) =>
      items[e.item]?.slot === 'eyes' && items[e.item].blink !== false ? { item: blinkItem, recolor: e.recolor } : e,
    );
  }

  private blinkDelay() {
    return 25 + Math.floor(this.random() * 40);
  }
}
