import type { JewelerMaterialId } from './jeweler.js';

export const UPGRADE_RECIPE_VERSION = 1;
export const COSMETIC_UPGRADE_COSTS: Readonly<Record<number, number>> = {
  2: 25_000,
  3: 60_000,
  4: 120_000,
  5: 220_000,
  6: 360_000,
};
export const PREMIUM_UPGRADE_MULTIPLIER = 2;
export const PET_UPGRADE_MULTIPLIER = 2;
export const UPGRADE_CHANCES: Readonly<Record<number, number>> = { 2: 85, 3: 75, 4: 55, 5: 35, 6: 25 };
export const UPGRADE_GUARANTEES: Readonly<Record<number, number>> = { 3: 5, 4: 10, 5: 15 };
export const UPGRADE_GROUPS: Readonly<Record<string, { recipe: 'normal' | 'wing' | 'pet' | 'goku'; max: number }>> = {
  'item/hat.cap': { recipe: 'normal', max: 3 },
  'item/hat.beanie': { recipe: 'normal', max: 3 },
  'item/hat.wizard': { recipe: 'normal', max: 5 },
  'item/hat.crown': { recipe: 'normal', max: 5 },
  'item/hat.halo': { recipe: 'normal', max: 5 },
  'item/hair.goku': { recipe: 'goku', max: 4 },
  ...Object.fromEntries(
    ['angel', 'ice', 'fire', 'shadow', 'fairy', 'dragon'].map((id) => [
      `item/wings.${id}`,
      { recipe: 'wing' as const, max: 6 },
    ]),
  ),
  ...Object.fromEntries(
    [
      'cat',
      'corgi',
      'bunny',
      'chick',
      'slime',
      'dragon',
      'fox',
      'robot',
      'ginger-cat',
      'puppy',
      'deer',
      'panda',
      'pig',
      'turtle',
      'clownfish',
      'songbird',
    ].map((id) => [`pet/${id}`, { recipe: 'pet' as const, max: 3 }]),
  ),
};

/** Explicit group allowlist: adding art alone never enables an unpriced upgrade. */
export function cosmeticUpgradeRecipe(groupId: string, nextLevel: number) {
  const group = Object.hasOwn(UPGRADE_GROUPS, groupId) ? UPGRADE_GROUPS[groupId] : undefined;
  const base = COSMETIC_UPGRADE_COSTS[nextLevel];
  if (!group || !base || nextLevel > group.max) return undefined;
  const stone = ({ 2: 'blue', 3: 'green', 4: 'purple', 5: 'pink', 6: 'gold' } as const)[nextLevel as 2 | 3 | 4 | 5 | 6];
  const materials: { materialId: JewelerMaterialId; count: number }[] = [{ materialId: stone, count: 1 }];
  if (group.recipe !== 'normal') {
    const gem = nextLevel <= 3 ? 'mystic' : nextLevel <= 5 ? 'stellar' : 'celestial';
    materials.push({ materialId: gem, count: nextLevel === 3 && group.recipe !== 'wing' ? 2 : 1 });
  }
  const coins =
    base * (group.recipe === 'pet' ? PET_UPGRADE_MULTIPLIER : group.recipe === 'goku' ? PREMIUM_UPGRADE_MULTIPLIER : 1);
  return {
    version: UPGRADE_RECIPE_VERSION,
    materials,
    coins,
    gems: group.recipe === 'goku' ? null : coins / 2500,
    chance: UPGRADE_CHANCES[nextLevel],
    guaranteeAt: UPGRADE_GUARANTEES[nextLevel] ?? null,
  };
}
