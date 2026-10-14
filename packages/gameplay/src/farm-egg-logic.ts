import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import type { FarmProgress } from './farm-crop-logic.js';
import { animalTimer } from './farm-progress-logic.js';

/** Baskets represent products waiting on the birds, independently from stored eggs. */
export function farmEggBaskets(state: FarmProgress, now: number) {
  return (['hen', 'duck'] as const).flatMap((species) => {
    const birds = state.poultry.filter((animal) => animal.species === species);
    if (!birds.length) return [];
    const ready = birds.filter((animal) => animalTimer(state, 'poultry', animal, now).ready).length;
    return [{ species, birds: birds.length, eggs: ready * FARM_ANIMAL_CATALOG[species].yield }];
  });
}
