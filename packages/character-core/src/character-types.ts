export type PoseEntry = { piece: string; dx: number; dy: number };
/** `blink: false` keeps the item through blinks (eyes that are already closed). */
/** Upgradable items share a `family` and have a `level` (1 = basic). */
/** Top-rank gear names a particle `effect` and a rarity `aura` (see character/effect-logic.ts). */
/** Head shapes wider than the standard head set `wide` (extra px); hair then uses its "<id>.w<wide>" variant. */
/**
 * Animated items (e.g. flapping wings) list `frames`: suffixes added to each pose's piece name,
 * shown in turn for `frameMs` each ("" is the pose's own piece). All frames of a pose share its size.
 */
export type CharacterGender = 'male' | 'female';
export type ItemDef = {
  gender?: CharacterGender;
  id: string;
  label: string;
  slot: string;
  layer: number;
  hidden?: boolean;
  blink?: boolean;
  family?: string;
  level?: number;
  frames?: string[];
  frameMs?: number;
  wide?: number;
  hairBelow?: number;
  effect?: string;
  aura?: number;
  poses: PoseEntry[];
};
/** Palette letter → colour, applied to an item's pieces (e.g. hair colour). */
export type Recolor = Record<string, string>;
export type Equip = { item: string; recolor?: Recolor };

/** One piece to draw, relative to the character origin. With `flip`, draw the piece mirrored. */
export type DrawOp = {
  piece: string;
  recolor?: Recolor;
  x: number;
  y: number;
  flip: boolean;
  clipTop?: number;
  /** Hat-covered [start,end) columns per native hair row; outside strands stay visible. */
  clipSpans?: [number, number][];
};

export type Outfit = {
  gender: CharacterGender;
  skin: string;
  face: string;
  hair: string;
  hairColor: string;
  hairLevel: string;
  hat: string;
  hatLevel: string;
  eyes: string;
  eyeColor: string;
  mouth: string;
  nose: string;
  mouthAcc: string;
  sticker: string;
  shirt: string;
  shirtColor: string;
  pants: string;
  pantsColor: string;
  shoes: string;
  shoesColor: string;
  wrist: string;
  wristColor: string;
  back: string;
  backLevel: string;
  held: string;
  tail: string;
  pet: string;
  petLevel: string;
};
