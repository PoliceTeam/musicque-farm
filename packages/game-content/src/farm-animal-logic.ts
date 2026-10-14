import { FARM_ANIMAL_CATALOG } from './farm-animal-catalog.js';
export type FarmSpecies = 'cow' | 'pig' | 'sheep' | 'hen' | 'duck' | 'fish' | 'buffalo' | 'turtle' | 'dog';
export const FARM_ANIMALS: FarmSpecies[] = [
  'cow',
  'pig',
  'sheep',
  'hen',
  'duck',
  'cow',
  'pig',
  'sheep',
  'hen',
  'duck',
  'cow',
  'pig',
  'sheep',
  'hen',
  'duck',
];
export const ANIMAL_STAGE_NAMES = ['Con non', 'Đang lớn', 'Trưởng thành'] as const;

/** Growth thresholds measured in fed time; legacy records retain their existing age. */
export function farmAnimalStage(species: FarmSpecies, index: number, elapsed: number): 0 | 1 | 2 {
  const step = FARM_ANIMAL_CATALOG[species].maturityMs / 3;
  const age = Math.max(0, elapsed) + (index % 3) * step * 1.5;
  return age < step ? 0 : age < step * 3 ? 1 : 2;
}
