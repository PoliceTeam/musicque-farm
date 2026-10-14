import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { FARM_ANIMAL_PRICES, FARM_UNIT_LIMITS } from '@chibi-town/game-content/farm-balance';
import { unitUpgradePrice } from '@chibi-town/game-content/farm-upgrade-catalog';

export { FARM_ANIMAL_PRICES, FARM_UNIT_LIMITS, FARM_UNIT_START } from '@chibi-town/game-content/farm-balance';

import { type FarmSpecies, farmAnimalStage } from '@chibi-town/game-content/farm-animal-logic';
import type { FarmProgress } from './farm-crop-logic.js';
export type FarmUnit = 'livestock' | 'poultry' | 'pond';
export type FarmAnimal = {
  id?: string;
  species: FarmSpecies;
  boughtAt: number;
  ageMs?: number;
  careAt?: number;
  productionMs?: number;
};

export function farmUnitLevel(unit: FarmUnit, capacity: number): 0 | 1 | 2 {
  if (unit === 'poultry') return 0;
  return capacity >= (unit === 'livestock' ? 20 : 8) ? 2 : capacity >= (unit === 'livestock' ? 15 : 5) ? 1 : 0;
}

export function farmUnitPrice(unit: FarmUnit, capacity: number) {
  return unitUpgradePrice(unit, capacity);
}

export function expandFarmUnit(state: FarmProgress, unit: FarmUnit) {
  const capacity = state.capacity[unit],
    price = farmUnitPrice(unit, capacity);
  if (price <= 0 || capacity >= FARM_UNIT_LIMITS[unit] || state.coins < price) return false;
  state.coins -= price;
  state.capacity[unit]++;
  if (unit !== 'poultry') state.units[unit] = farmUnitLevel(unit, state.capacity[unit]);
  return true;
}

export function farmUnitAnimals(state: FarmProgress, unit: FarmUnit) {
  return unit === 'pond' ? state.fish : unit === 'poultry' ? state.poultry : state.animals;
}

export function buyFarmAnimal(state: FarmProgress, unit: FarmUnit, species: FarmSpecies, now: number) {
  if (
    !Number.isFinite(now) ||
    now < 0 ||
    !Object.hasOwn(FARM_ANIMAL_PRICES, species) ||
    (unit === 'pond'
      ? !['fish', 'turtle'].includes(species)
      : unit === 'poultry'
        ? !isFreeAnimal(species)
        : ['fish', 'turtle'].includes(species) || isFreeAnimal(species))
  )
    return false;
  const animals = farmUnitAnimals(state, unit);
  const definition = FARM_ANIMAL_CATALOG[species];
  if (!definition.available || animals.length >= state.capacity[unit] || state[definition.currency] < definition.price)
    return false;
  state[definition.currency] -= definition.price;
  state.animalStartedAt ??= now;
  let serial = 0;
  while (animals.some((a) => a.id === `${species}:${now}:${serial}`)) serial++;
  animals.push({ id: `${species}:${now}:${serial}`, species, boughtAt: now, ageMs: 0, careAt: now, productionMs: 0 });
  return true;
}

export function farmRecordStage(animal: FarmAnimal, now: number) {
  return farmAnimalStage(animal.species, 0, animal.ageMs ?? Math.max(0, now - animal.boughtAt));
}

export function isFreeAnimal(species: FarmSpecies) {
  return species === 'hen' || species === 'duck';
}
