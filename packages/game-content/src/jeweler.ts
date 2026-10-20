/** Server-owned prices and recipes. Quantities are permanent material holdings, separate from cosmetic slots. */
export const JEWELER_MATERIALS = [
  { id: 'blue', buy: 5000, sell: 3000 },
  { id: 'green', buy: 15000, sell: 13000, recipe: { material: 'blue', count: 3 } },
  { id: 'purple', buy: 45000, sell: 40000, recipe: { material: 'green', count: 3 } },
  { id: 'pink', buy: 90000, sell: 85000, recipe: { material: 'purple', count: 2 } },
  { id: 'gold', buy: 180000, sell: 170000, recipe: { material: 'pink', count: 2 } },
  { id: 'mystic', buy: 15000, sell: 13000 },
  { id: 'stellar', buy: 45000, sell: 40000, recipe: { material: 'mystic', count: 3 } },
  { id: 'celestial', buy: 90000, sell: 85000, recipe: { material: 'stellar', count: 3 } },
] as const;
export type JewelerMaterialId = (typeof JEWELER_MATERIALS)[number]['id'];
