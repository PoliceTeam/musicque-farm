import type { CharacterGender } from './character-types.js';
import { type CosmeticCategory, cosmeticCategoryForSlot } from './cosmetic-categories.js';

export { type CosmeticCategory, cosmeticCategoryForSlot } from './cosmetic-categories.js';

import { colors, items, pets } from './item-catalog.js';

/** Stable purchase/reward IDs, independent of display names and sprite pieces. */
export type CosmeticId = `item/${string}` | `pet/${string}` | `item-color/${string}/${string}` | `skin-color/${string}`;
type CosmeticBase = {
  id: CosmeticId;
  label: string;
  category: CosmeticCategory;
  /** One wardrobe/shop card per family; levels and colors remain individually owned. */
  groupId: string;
};
type ItemReference = {
  itemId: string;
  slot: string;
  gender?: CharacterGender;
  family?: string;
  level?: number;
};
type ColorReference = {
  colorGroup: string;
  colorId: string;
  /** Current renderer palette key; never use this translated value as the ownership ID. */
  colorValue: string;
};
export type CosmeticDefinition = CosmeticBase &
  (
    | ({ kind: 'item' } & ItemReference)
    | ({ kind: 'item-color'; requires: CosmeticId } & ItemReference & ColorReference)
    | { kind: 'pet'; petId: string; family?: string; level?: number }
    | ({ kind: 'skin-color' } & ColorReference)
  );

/** Append IDs when palettes are added. Never derive persisted IDs from translated labels or array indexes. */
export const COSMETIC_COLOR_IDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  skin: { Sáng: 'light', 'Trắng hồng': 'rosy', Ngăm: 'tan', Nâu: 'brown' },
  hair: {
    'Nâu hạt dẻ': 'chestnut',
    Đen: 'black',
    Nâu: 'brown',
    Vàng: 'blond',
    Đỏ: 'red',
    'Xanh dương': 'blue',
    'Xanh lá': 'green',
    Tím: 'purple',
    Trắng: 'white',
  },
  shirt: {
    Hồng: 'pink',
    'Tím than': 'dark-purple',
    Trắng: 'white',
    Đỏ: 'red',
    'Xanh dương': 'blue',
    Vàng: 'yellow',
    Cam: 'orange',
  },
  pants: { Hồng: 'pink', Đen: 'black', Jean: 'denim', Kaki: 'khaki', Đỏ: 'red', Cam: 'orange' },
  shoes: { Hồng: 'pink', Đỏ: 'red', Xanh: 'blue', Trắng: 'white', Đen: 'black' },
  eyes: { Đen: 'black', Nâu: 'brown', 'Xanh dương': 'blue', 'Xanh lá': 'green', Tím: 'purple', Đỏ: 'red' },
  wrist: { Đỏ: 'red', Xanh: 'blue', Vàng: 'yellow' },
};

/** Catalog only: entries are eligible for shop/event/quest configuration, not automatically owned or on sale. */
export function createCosmeticCatalog(): Readonly<Record<CosmeticId, Readonly<CosmeticDefinition>>> {
  const catalog: Partial<Record<CosmeticId, Readonly<CosmeticDefinition>>> = {};

  function add(definition: CosmeticDefinition) {
    if (catalog[definition.id]) throw new Error(`Duplicate cosmetic ID: ${definition.id}`);
    catalog[definition.id] = Object.freeze(definition);
  }

  function paletteEntries(group: string) {
    return Object.keys(colors[group] ?? {}).map((value) => {
      const id = COSMETIC_COLOR_IDS[group]?.[value];
      if (!id) throw new Error(`Missing stable color ID: ${group}/${value}`);
      return { id, value };
    });
  }

  for (const item of Object.values(items)) {
    // Hidden hair backs, fitting variants and hands are implementation details of the owned parent.
    if (item.hidden || item.slot === 'body') continue;
    const id: CosmeticId = `item/${item.id}`;
    const category = cosmeticCategoryForSlot(item.slot);
    const groupId = `item/${item.family ?? item.id}`;
    add({
      id,
      kind: 'item',
      category,
      groupId,
      label: item.label,
      itemId: item.id,
      slot: item.slot,
      gender: item.gender,
      family: item.family,
      level: item.level,
    });
    for (const color of paletteEntries(item.slot)) {
      add({
        id: `item-color/${item.id}/${color.id}`,
        kind: 'item-color',
        category,
        groupId,
        label: `${item.label} · ${color.value}`,
        itemId: item.id,
        slot: item.slot,
        gender: item.gender,
        family: item.family,
        level: item.level,
        colorGroup: item.slot,
        colorId: color.id,
        colorValue: color.value,
        requires: id,
      });
    }
  }
  for (const pet of Object.values(pets)) {
    add({
      id: `pet/${pet.id}`,
      kind: 'pet',
      category: 'pet',
      groupId: `pet/${pet.family ?? pet.id}`,
      label: pet.label,
      petId: pet.id,
      family: pet.family,
      level: pet.level,
    });
  }
  for (const color of paletteEntries('skin')) {
    add({
      id: `skin-color/${color.id}`,
      kind: 'skin-color',
      category: 'appearance',
      groupId: 'appearance/skin',
      label: color.value,
      colorGroup: 'skin',
      colorId: color.id,
      colorValue: color.value,
    });
  }
  return Object.freeze(catalog) as Readonly<Record<CosmeticId, Readonly<CosmeticDefinition>>>;
}

export const COSMETIC_CATALOG = createCosmeticCatalog();

export type CosmeticGroup = {
  id: string;
  category: CosmeticCategory;
  /** Item/Pet levels; never include individual palette unlocks in the top-level product list. */
  members: readonly CosmeticId[];
  colors: readonly CosmeticId[];
};

/** Build once, in linear time, rather than re-scanning all variants for every shop card. */
export function createCosmeticGroups(catalog: Readonly<Record<CosmeticId, Readonly<CosmeticDefinition>>>) {
  const groups: Record<
    string,
    { id: string; category: CosmeticCategory; members: CosmeticId[]; colors: CosmeticId[] }
  > = {};
  for (const entry of Object.values(catalog)) {
    groups[entry.groupId] ??= { id: entry.groupId, category: entry.category, members: [], colors: [] };
    const group = groups[entry.groupId];
    if (group.category !== entry.category) throw new Error(`Mixed cosmetic categories: ${entry.groupId}`);
    (entry.kind === 'item-color' || entry.kind === 'skin-color' ? group.colors : group.members).push(entry.id);
  }
  const result: Record<string, Readonly<CosmeticGroup>> = {};
  for (const [id, group] of Object.entries(groups)) {
    result[id] = Object.freeze({
      ...group,
      members: Object.freeze(group.members),
      colors: Object.freeze(group.colors),
    });
  }
  return Object.freeze(result);
}

export const COSMETIC_GROUPS = createCosmeticGroups(COSMETIC_CATALOG);
