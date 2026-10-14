import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FARM_RECIPES, type RecipeId } from '@chibi-town/game-content/farm-recipes';
import { describe, expect, it } from 'vitest';
import { foodIconUrl, REFERENCE_FOOD_IDS } from '@/features/farm/_utils/food-art';

describe('recipe reference artwork', () => {
  it('resolves reference artwork for every recipe', () => {
    expect(Object.keys(REFERENCE_FOOD_IDS)).toHaveLength(Object.keys(FARM_RECIPES).length);
    for (const id of Object.keys(FARM_RECIPES) as RecipeId[]) {
      const url = foodIconUrl(id);
      if (REFERENCE_FOOD_IDS[id]) {
        const path = url.replace(/^\/(?:chibi-assets|src\/assets)\//, '../src/assets/');
        expect(existsSync(fileURLToPath(new URL(path, import.meta.url))), id).toBe(true);
      } else {
        expect(url.startsWith('data:image/svg+xml,')).toBe(true);
      }
    }
  });
});
