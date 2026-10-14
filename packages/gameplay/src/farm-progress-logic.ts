import { FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { cropStage, type FarmCrop, type FarmProgress } from './farm-crop-logic.js';
import { FARM_FOOD_MS } from './farm-feeding-logic.js';
import { animalMaturityMs, productCycleMs } from './farm-product-logic.js';
import type { FarmAnimal, FarmUnit } from './farm-unit-logic.js';

export type FarmTimer = {
  percent: number;
  remainingMs: number;
  ready: boolean;
  paused: boolean;
  phase: 'growth' | 'production';
};

function timer(elapsed: number, total: number, paused = false, phase: FarmTimer['phase'] = 'growth'): FarmTimer {
  const remainingMs = Math.max(0, total - elapsed);
  return {
    percent: total ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100,
    remainingMs,
    ready: remainingMs === 0,
    paused: paused && remainingMs > 0,
    phase,
  };
}

export function cropTimer(crop: FarmCrop, now: number): FarmTimer | undefined {
  const stage = cropStage(crop, now);
  if (stage !== 'growing' && stage !== 'ripe') return;
  const total = FARM_CROPS[crop.cropId ?? 'strawberry'].growMs;
  return timer(stage === 'ripe' ? total : Math.max(0, now - crop.wateredAt!), total);
}

/** Read-only projection between SDK snapshots; food-bound time matches simulation rules. */
export function animalTimer(state: FarmProgress, unit: FarmUnit, animal: FarmAnimal, now: number): FarmTimer {
  const fed = state.fedAt[unit];
  const previous = animal.careAt ?? now;
  const elapsed =
    fed === null ? 0 : Math.max(0, Math.min(now, fed + FARM_FOOD_MS) - Math.max(previous, fed, animal.boughtAt));
  const maturity = animalMaturityMs(animal);
  const age = animal.ageMs ?? Math.min(maturity, Math.max(0, now - animal.boughtAt));
  const growth = Math.min(elapsed, Math.max(0, maturity - age));
  const paused = fed === null || now >= fed + FARM_FOOD_MS;
  if (age + growth < maturity) return timer(age + growth, maturity, paused);
  return timer((animal.productionMs ?? 0) + elapsed - growth, productCycleMs(animal), paused, 'production');
}
