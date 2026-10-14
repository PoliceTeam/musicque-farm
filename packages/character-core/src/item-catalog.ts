import type { CharacterGender, Recolor } from './character-types.js';
import colorData from './data/colors.json' with { type: 'json' };
import itemData from './data/items.json' with { type: 'json' };
import petData from './data/pets.json' with { type: 'json' };
import { type ItemsFile, loadItems } from './item-loader.js';

export const itemDefinitions = itemData as unknown as ItemsFile;
export const items = loadItems(itemDefinitions);
export const colors = colorData as Record<string, Record<string, Recolor>>;

export const itemsInSlot = (slot: string) =>
  Object.values(items).filter((i) => i.slot === slot && !i.hidden && !i.family);

/** Names of the upgrade levels, from level 1. */
export const RARITY = ['Cơ bản', 'Nâng cấp', 'Hiếm', 'Sử thi', 'Huyền thoại', 'Thần thoại'];

/** An upgradable item family: its id, a label without the level, and the levels that exist. */
export type Family = { id: string; label: string; slot: string; levels: number[]; gender?: CharacterGender };
export const families: Record<string, Family> = {};
for (const item of Object.values(items)) {
  if (!item.family || !item.level) continue;
  families[item.family] ??= {
    id: item.family,
    label: item.label.replace(/ Lv\.\d+$/, ''),
    slot: item.slot,
    gender: item.gender,
    levels: [],
  };
  const f = families[item.family];
  f.levels.push(item.level);
  f.levels.sort((a, b) => a - b);
}

export const familiesInSlot = (slot: string) => Object.values(families).filter((f) => f.slot === slot);

/** The item for a family at a level, falling back to the highest level not above it. */
export function itemAtLevel(family: string, level: number): string | undefined {
  const f = families[family];
  if (!f) return undefined;
  const lv = [...f.levels].reverse().find((l) => l <= level) ?? f.levels[0];
  return `${family}.${lv}`;
}

/**
 * `walk` lists the frames cycled while the pet moves (legs taking turns); all frames of a pet share
 * its standing size except squash frames, which stay bottom-aligned. `hop` is how high it bounces.
 * A flyer has `fly` (hover height in px) and `flap` (wing frames, cycled even at rest).
 */
/** Pets evolve: every species is a `family` with levels 1..3; level 1's id is the family id. */
export type PetDef = {
  id: string;
  label: string;
  piece: string;
  walk?: string[];
  flap?: string[];
  fly?: number;
  hop?: number;
  recolor?: Recolor;
  family?: string;
  level?: number;
  effect?: string;
  aura?: number;
};
export const pets: Record<string, PetDef> = {};
for (const pet of petData.pets as PetDef[]) pets[pet.id] = pet;

/** Pets to pick in the wardrobe: level 1 of each family (or pets without a family). */
export const basePets = () => Object.values(pets).filter((p) => !p.family || p.family === p.id);

/** Highest level any pet family reaches. */
export const PET_LEVELS = Math.max(1, ...Object.values(pets).map((p) => p.level ?? 1));

/** The pet of a family at a level, falling back to the highest level not above it. */
export function petAtLevel(id: string, level: number): PetDef | undefined {
  const base = pets[id];
  if (!base) return undefined;
  const family = base.family ?? base.id;
  const levels = Object.values(pets)
    .filter((p) => (p.family ?? p.id) === family)
    .sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
  return [...levels].reverse().find((p) => (p.level ?? 1) <= level) ?? base;
}

/** Absence of gender means the item is shared. Metadata controls both UI and equip validation. */
export function itemAvailableForGender(id: string, gender: CharacterGender): boolean {
  const definition = items[id] ?? families[id];
  return !!definition && (!definition.gender || definition.gender === gender);
}
