// A player's appearance: item ids per slot plus colour names, turned into an equip list.
import type { CharacterGender, Equip, Outfit, Recolor } from './character-types.js';
import {
  basePets,
  colors,
  families,
  familiesInSlot,
  itemAtLevel,
  itemAvailableForGender,
  items,
  itemsInSlot,
  PET_LEVELS,
  type PetDef,
  petAtLevel,
  pets,
  RARITY,
} from './item-catalog.js';
import { pick } from './random.js';

/** Value of an optional slot that is left empty. */
export const NONE = '';

/** The reference character: black mop hair, purple tank top, black trousers, red shoes. */
export const defaultOutfit: Outfit = {
  gender: 'male',
  skin: 'Sáng',
  face: 'head',
  hair: 'hair.mop',
  hairColor: 'Đen',
  hairLevel: '1',
  hat: NONE,
  hatLevel: '1',
  eyes: 'eyes.big',
  eyeColor: 'Đen',
  mouth: NONE,
  nose: NONE,
  mouthAcc: NONE,
  sticker: NONE,
  shirt: 'shirt.tank',
  shirtColor: 'Tím than',
  pants: 'pants',
  pantsColor: 'Đen',
  shoes: 'shoes',
  shoesColor: 'Đỏ',
  wrist: 'wrist.band',
  wristColor: 'Đỏ',
  back: NONE,
  backLevel: '1',
  held: NONE,
  tail: NONE,
  pet: NONE,
  petLevel: '1',
};

/** A complete basic Goku set; individual items remain independently selectable. */
export const gokuOutfit: Outfit = {
  ...defaultOutfit,
  hair: 'hair.goku',
  hairColor: 'Đen',
  shirt: 'shirt.goku',
  shirtColor: 'Cam',
  pants: 'pants.goku',
  pantsColor: 'Cam',
  shoes: 'shoes.goku',
  shoesColor: 'Xanh',
  wrist: 'wrist.goku',
  wristColor: 'Xanh',
  held: 'held.nyoibo',
  tail: 'tail.monkey',
};

/** Female starter on the shared skeleton; every item remains independently selectable. */
export const femaleOutfit: Outfit = {
  ...defaultOutfit,
  gender: 'female',
  skin: 'Trắng hồng',
  face: 'face.slim',
  hair: 'hair.female-long',
  hairColor: 'Nâu hạt dẻ',
  eyes: 'eyes.female',
  eyeColor: 'Nâu',
  shirt: 'shirt.female',
  shirtColor: 'Hồng',
  pants: 'pants.female',
  pantsColor: 'Hồng',
  shoes: 'shoes.female',
  shoesColor: 'Hồng',
  wrist: NONE,
};

/** Canonical base palette for each item family, shared by shop rewards and previews. */
export function defaultItemOutfit(itemId: string, gender?: CharacterGender): Outfit {
  if (
    /^(hair|shirt|pants|shoes|wrist)\.goku(?:\.|$)/.test(itemId) ||
    itemId === 'held.nyoibo' ||
    itemId === 'tail.monkey'
  )
    return gokuOutfit;
  return gender === 'female' ? femaleOutfit : defaultOutfit;
}

/**
 * A field picks an item in `slot`, a colour in `colors`, a pet id (with `pet`), or the upgrade level
 * of the family chosen in another field (with `levelOf`). In a slot with upgradable items (wings),
 * the slot field picks a family and its level field picks the level.
 */
type Field = {
  key: Exclude<keyof Outfit, 'gender'>;
  label: string;
  slot?: string;
  colors?: string;
  pet?: boolean;
  levelOf?: keyof Outfit;
  optional?: boolean;
  noneChance?: number;
};

/** Which slot or colour group each outfit field belongs to; used for validation and the UI. */
export const outfitFields: Field[] = [
  { key: 'skin', label: 'Màu da', colors: 'skin' },
  { key: 'face', label: 'Khuôn mặt', slot: 'head' },
  { key: 'hair', label: 'Tóc', slot: 'hair', optional: true, noneChance: 0.1 },
  { key: 'hairLevel', label: 'Cấp tóc', levelOf: 'hair' },
  { key: 'hairColor', label: 'Màu tóc', colors: 'hair' },
  { key: 'hat', label: 'Mũ', slot: 'hat', optional: true, noneChance: 0.7 },
  { key: 'hatLevel', label: 'Cấp mũ', levelOf: 'hat' },
  { key: 'eyes', label: 'Mắt', slot: 'eyes' },
  { key: 'eyeColor', label: 'Màu mắt', colors: 'eyes' },
  { key: 'mouth', label: 'Miệng', slot: 'mouth', optional: true },
  { key: 'nose', label: 'Mũi', slot: 'nose', optional: true },
  { key: 'mouthAcc', label: 'Đồ ở miệng', slot: 'mouthAcc', optional: true, noneChance: 0.7 },
  { key: 'sticker', label: 'Sticker má', slot: 'sticker', optional: true, noneChance: 0.7 },
  { key: 'shirt', label: 'Áo', slot: 'shirt', optional: true, noneChance: 0.1 },
  { key: 'shirtColor', label: 'Màu áo', colors: 'shirt' },
  { key: 'pants', label: 'Quần', slot: 'pants' },
  { key: 'pantsColor', label: 'Màu quần', colors: 'pants' },
  { key: 'shoes', label: 'Giày', slot: 'shoes', optional: true, noneChance: 0.1 },
  { key: 'shoesColor', label: 'Màu giày', colors: 'shoes' },
  { key: 'wrist', label: 'Băng tay', slot: 'wrist', optional: true },
  { key: 'wristColor', label: 'Màu băng tay', colors: 'wrist' },
  { key: 'back', label: 'Cánh', slot: 'back', optional: true, noneChance: 0.7 },
  { key: 'backLevel', label: 'Cấp cánh', levelOf: 'back' },
  { key: 'tail', label: 'Đuôi', slot: 'tail', optional: true, noneChance: 0.7 },
  { key: 'held', label: 'Cầm tay', slot: 'held', optional: true, noneChance: 0.7 },
  { key: 'pet', label: 'Thú cưng', pet: true, optional: true },
  { key: 'petLevel', label: 'Cấp thú cưng', levelOf: 'pet' },
];

/** Choices for a field as [value, label]; optional fields start with "none". */
export function fieldOptions(f: Field, outfit?: Outfit): [string, string][] {
  let list: [string, string][];
  if (f.colors) list = Object.keys(colors[f.colors]).map((name) => [name, name]);
  else if (f.pet) list = basePets().map((p) => [p.id, p.label]);
  else if (f.levelOf === 'hair') {
    const levels = outfit ? (families[outfit.hair]?.levels ?? [1]) : [1, 2, 3, 4];
    const names = ['Goku cơ bản', 'Super Saiyan', 'Super Saiyan 2', 'Super Saiyan 3'];
    list = levels.map((level) => [String(level), `Lv.${level} · ${names[level - 1]}`]);
  } else if (f.levelOf === 'hat') {
    const levels = outfit
      ? (families[outfit.hat]?.levels ?? [1, 2, 3])
      : [...new Set(familiesInSlot('hat').flatMap((fam) => fam.levels))].sort((a, b) => a - b);
    list = levels.map((level) => [String(level), `Lv.${level} · ${RARITY[level - 1]}`]);
  } else if (f.levelOf)
    list = RARITY.slice(0, f.levelOf === 'pet' ? PET_LEVELS : RARITY.length).map((name, i) => [
      String(i + 1),
      `Lv.${i + 1} · ${name}`,
    ]);
  else
    list = [
      ...itemsInSlot(f.slot!)
        .filter((item) => itemAvailableForGender(item.id, outfit?.gender ?? 'male'))
        .map((i) => [i.id, i.label] as [string, string]),
      ...familiesInSlot(f.slot!)
        .filter((family) => itemAvailableForGender(family.id, outfit?.gender ?? 'male'))
        .map((fam) => [fam.id, fam.label] as [string, string]),
    ];
  return f.optional ? [[NONE, 'Không'], ...list] : list;
}

/** The item worn in a slot field: a plain item, or an upgradable family at the chosen level. */
function wornItem(o: Outfit, key: keyof Outfit, levelKey?: keyof Outfit): string {
  const v = o[key];
  if (!v || !families[v]) return v;
  return itemAtLevel(v, Number(levelKey ? o[levelKey] : 1)) ?? NONE;
}

/** The pet that follows this outfit: the chosen species at the chosen level. */
export function wornPet(o: Outfit): PetDef | undefined {
  return o.pet ? petAtLevel(o.pet, Number(o.petLevel) || 1) : undefined;
}

/** Fingers drawn over a held item's handle, so the fist closes around it. */
export const GRIP = 'hand.grip';

/**
 * Equip list for an outfit. Every colour group has its own palette letters, so one merged recolour
 * serves all items; hair needs it because the shadow it casts on the forehead is skin-coloured.
 * A hairstyle with a matching "<id>.back" item also draws that part behind the head.
 * Faces wider than the standard head pick the hairstyle's matching "<id>.w<px>" variant.
 */
export function toEquip(o: Outfit): Equip[] {
  const recolor: Recolor = {
    ...colors.skin[o.skin],
    ...colors.hair[o.hairColor],
    ...colors.shirt[o.shirtColor],
    ...colors.pants[o.pantsColor],
    ...colors.shoes[o.shoesColor],
    ...colors.wrist[o.wristColor],
    ...colors.eyes[o.eyeColor],
  };
  // A wider face wears a widened copy of the hairstyle so the hair still covers the head.
  const wide = items[o.face]?.wide;

  const sized = (id: string) => (wide && items[`${id}.w${wide}`] ? `${id}.w${wide}` : id);

  const hairId = wornItem(o, 'hair', 'hairLevel');
  const hair = hairId && sized(hairId);
  const hairBack = hairId && items[`${hairId}.back`] ? sized(`${hairId}.back`) : NONE;
  const hatId = wornItem(o, 'hat', 'hatLevel');
  const fittedHat = o.gender === 'female' && items[`${hatId}.female`] ? `${hatId}.female` : hatId;
  const hat = sized(fittedHat);
  const hairTie = items[hat]?.hairBelow !== undefined && items[`${hairId}.tie`] ? sized(`${hairId}.tie`) : NONE;
  const ids = [
    'body',
    o.face,
    o.eyes,
    o.mouth,
    o.nose,
    o.mouthAcc,
    o.sticker,
    o.shirt,
    o.pants,
    o.shoes,
    o.wrist,
    o.tail,
    wornItem(o, 'back', 'backLevel'),
    o.held,
    o.held && GRIP,
    hair,
    hairBack,
    hat,
    hairTie,
  ];
  return ids.filter((id) => !!id && itemAvailableForGender(id, o.gender ?? 'male')).map((item) => ({ item, recolor }));
}

export function randomOutfit(random: () => number = Math.random, gender: CharacterGender = 'male'): Outfit {
  const out = { ...(gender === 'female' ? femaleOutfit : defaultOutfit) };
  for (const f of outfitFields) {
    const choices = fieldOptions(f, out)
      .map(([value]) => value)
      .filter((v) => v !== NONE);
    out[f.key] = f.optional && random() < (f.noneChance ?? 0.5) ? NONE : pick(choices, random);
  }
  return out;
}

/** Keep only values that still exist (items or colours may be renamed between versions). */
export function sanitizeOutfit(value: unknown): Outfit {
  if (!value || typeof value !== 'object') return { ...defaultOutfit };
  const given = value as Record<string, unknown>;
  // Infer old female presets saved before gender was stored; legacy male saves retain their appearance.
  const gender: CharacterGender =
    given.gender === 'female' ||
    (given.gender === undefined &&
      [given.hair, given.shirt, given.pants].some((id) => typeof id === 'string' && items[id]?.gender === 'female'))
      ? 'female'
      : 'male';
  const out = { ...(gender === 'female' ? femaleOutfit : defaultOutfit) };
  for (const f of outfitFields) {
    const v = given[f.key];
    if (typeof v !== 'string') continue;
    const valid =
      (f.optional && v === NONE) ||
      (f.colors
        ? v in colors[f.colors]
        : f.pet
          ? v in pets && basePets().includes(pets[v])
          : f.levelOf
            ? fieldOptions(f, out).some(([value]) => value === v)
            : (items[v]?.slot === f.slot && !items[v].hidden && !items[v].family) || families[v]?.slot === f.slot);
    if (valid && (!f.slot || !v || itemAvailableForGender(v, gender))) out[f.key] = v;
  }
  return out;
}

/** Clamp dependent levels after changing a family, without changing unrelated choices. */
export function normalizeOutfitLevels(outfit: Outfit): Outfit {
  const next = { ...outfit };
  for (const key of ['hatLevel', 'hairLevel'] as const) {
    const choices = fieldOptions(outfitFields.find((f) => f.key === key)!, next);
    if (!choices.some(([id]) => id === next[key])) next[key] = key === 'hairLevel' ? '1' : choices.at(-1)![0];
  }
  return next;
}

/** Starter customization uses ordinary clothing; special sets and equipment stay out of signup. */
export const starterOutfitFields = outfitFields.filter((field) =>
  [
    'skin',
    'face',
    'hair',
    'eyeColor',
    'shirt',
    'shirtColor',
    'pants',
    'pantsColor',
    'shoes',
    'shoesColor',
    'wrist',
    'wristColor',
  ].includes(field.key),
);

export function starterFieldOptions(field: (typeof outfitFields)[number], outfit: Outfit): [string, string][] {
  return fieldOptions(field, outfit).filter(([id]) => !/goku|nyoibo|monkey/i.test(id) && id !== 'boots');
}

export function starterOutfit(value: unknown): Outfit {
  const given = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const outfit = { ...(given.gender === 'female' ? femaleOutfit : defaultOutfit) };
  for (const field of starterOutfitFields) {
    const selected = given[field.key];
    if (typeof selected === 'string' && starterFieldOptions(field, outfit).some(([id]) => id === selected))
      outfit[field.key] = selected;
  }
  return outfit;
}
