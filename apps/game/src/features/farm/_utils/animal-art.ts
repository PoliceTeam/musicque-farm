import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import type { FarmAnimal } from '@chibi-town/gameplay/farm-unit-logic';

export const ANIMAL_ART_STAGES = ['Mới sinh', 'Con non', 'Đang lớn', 'Trưởng thành'] as const;
export const ANIMAL_ART_SCALES = [0.48, 0.62, 0.82, 1] as const;
export type AnimalArtAction = 'idle' | 'walk' | 'eat' | 'sleep';

export const ANIMAL_MOTION_STEPS = 32;
export const ANIMAL_MOTION_STEP_MS = 35;
export const ANIMAL_MOTION_GROUP = ANIMAL_MOTION_STEPS * 2;

/** Split the existing juvenile period visually; maturity and production rules stay the same. */
export function animalArtStage(animal: FarmAnimal, now: number) {
  const age = animal.ageMs ?? Math.max(0, now - animal.boughtAt);
  const fraction = age / FARM_ANIMAL_CATALOG[animal.species].maturityMs;
  return fraction < 1 / 6 ? 0 : fraction < 1 / 3 ? 1 : fraction < 1 ? 2 : 3;
}

export function animalArtFrameName(species: FarmSpecies, stage: number, action: AnimalArtAction, tick: number) {
  if (stage < 3) return `${species}-growth-${stage}`;
  const count =
    action === 'walk'
      ? species === 'hen' || species === 'duck'
        ? 7
        : species === 'fish' || species === 'buffalo'
          ? 5
          : 6
      : action === 'eat'
        ? 3
        : 2;
  return `${species}-${action}-${tick % count}`;
}

export function animalArtWidth(species: FarmSpecies, stage: number) {
  return (
    (species === 'cow' || species === 'buffalo' ? 43 : species === 'hen' || species === 'duck' ? 23 : 35) *
    ANIMAL_ART_SCALES[stage]
  );
}
