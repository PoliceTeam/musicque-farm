import { FARM_RECIPES, type RecipeId } from '@chibi-town/game-content/farm-recipes';
import type { FarmProgress } from './farm-crop-logic.js';
import type { FarmProduct } from './farm-product-logic.js';
import { canStoreFarmGoods } from './farm-storage-logic.js';

export type KitchenJob = { id: string; recipeId: RecipeId; startedAt: number; readyAt: number };
export const KITCHEN_SLOTS = 1;

export function parseKitchenJobs(value: unknown): KitchenJob[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((job): job is KitchenJob =>
      Boolean(
        job &&
          typeof job.id === 'string' &&
          Object.hasOwn(FARM_RECIPES, job.recipeId) &&
          Number.isFinite(job.startedAt) &&
          job.startedAt >= 0 &&
          job.readyAt === job.startedAt + FARM_RECIPES[job.recipeId as RecipeId].cookMs,
      ),
    )
    .slice(0, KITCHEN_SLOTS)
    .map((job) => ({ ...job }));
}

export function startFarmRecipe(state: FarmProgress, recipeId: RecipeId, now: number, jobId: string) {
  if (
    !Object.hasOwn(FARM_RECIPES, recipeId) ||
    !Number.isFinite(now) ||
    now < 0 ||
    !jobId ||
    state.kitchen.length >= KITCHEN_SLOTS
  )
    return false;
  const recipe = FARM_RECIPES[recipeId];
  const ingredients = Object.entries(recipe.ingredients) as [FarmProduct, number][];
  if (ingredients.some(([id, quantity]) => (state.inventory[id] ?? 0) < quantity)) return false;
  if (!Number.isSafeInteger(now + recipe.cookMs)) return false;
  for (const [id, quantity] of ingredients) state.inventory[id] = (state.inventory[id] ?? 0) - quantity;
  state.kitchen.push({ id: jobId, recipeId, startedAt: now, readyAt: now + recipe.cookMs });
  return true;
}

export function collectFarmRecipe(state: FarmProgress, jobId: string, now: number) {
  const index = state.kitchen.findIndex((job) => job.id === jobId);
  const job = state.kitchen[index];
  if (!job || !Number.isFinite(now) || now < job.readyAt) return false;
  const count = (state.inventory[job.recipeId] ?? 0) + 1;
  if (!canStoreFarmGoods(state, { [job.recipeId]: 1 })) return false;
  state.inventory[job.recipeId] = count;
  state.kitchen.splice(index, 1);
  return true;
}
