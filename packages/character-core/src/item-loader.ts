import { POSE_COUNT } from './animation-logic.js';
import type { CharacterGender, ItemDef, PoseEntry } from './character-types.js';
import type { SpriteSheet } from './sprite-types.js';

type RawItem = {
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
  poses: Record<string, [string, number, number]>;
};
/** Shape of character-core data/items.json. JSON imports type tuples loosely, so loadItems checks entries at runtime. */
export type ItemsFile = { items: RawItem[] };

/** Expand raw item JSON: every item gets all POSE_COUNT poses, missing ones falling back to pose 0. */
export function loadItems(raw: ItemsFile, sheet?: SpriteSheet): Record<string, ItemDef> {
  const items: Record<string, ItemDef> = {};
  for (const item of raw.items) {
    if (item.gender !== undefined && !['male', 'female'].includes(item.gender))
      throw new Error(`item "${item.id}": bad gender`);
    if (items[item.id]) throw new Error(`item "${item.id}" is defined twice`);
    const given: Record<number, PoseEntry> = {};
    for (const [key, entry] of Object.entries(item.poses)) {
      const pose = Number(key);
      if (!Array.isArray(entry) || entry.length !== 3)
        throw new Error(`item "${item.id}" pose ${key}: expected [piece, dx, dy]`);
      const [piece, dx, dy] = entry;
      if (!Number.isInteger(pose) || pose < 0 || pose >= POSE_COUNT)
        throw new Error(`item "${item.id}": bad pose "${key}"`);
      if (sheet && !sheet.pieces[piece]) throw new Error(`item "${item.id}" pose ${pose}: missing piece "${piece}"`);
      if (!Number.isInteger(dx) || !Number.isInteger(dy))
        throw new Error(`item "${item.id}" pose ${pose}: offsets must be whole pixels`);
      given[pose] = { piece, dx, dy };
    }
    if (!given[0]) throw new Error(`item "${item.id}" has no pose 0`);
    const poses = Array.from({ length: POSE_COUNT }, (_, pose) => given[pose] ?? given[0]);
    if (item.frames) {
      if (!item.frames.length || !(Number(item.frameMs) > 0))
        throw new Error(`item "${item.id}": frames need a positive frameMs`);
      for (const { piece } of poses) {
        const base = sheet?.pieces[piece];
        for (const suffix of item.frames) {
          if (!sheet) continue;
          const frame = sheet.pieces[piece + suffix];
          if (!frame) throw new Error(`item "${item.id}": missing frame piece "${piece + suffix}"`);
          if (frame.width !== base!.width || frame.height !== base!.height)
            throw new Error(`item "${item.id}": frame "${piece + suffix}" is not the size of "${piece}"`);
        }
      }
    }
    items[item.id] = {
      gender: item.gender,
      id: item.id,
      label: item.label,
      slot: item.slot,
      layer: item.layer,
      hidden: item.hidden,
      blink: item.blink,
      family: item.family,
      level: item.level,
      frames: item.frames,
      frameMs: item.frameMs,
      wide: item.wide,
      hairBelow: item.hairBelow,
      effect: item.effect,
      aura: item.aura,
      poses,
    };
  }
  return items;
}
