import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { FARM_PRODUCTS } from '@chibi-town/game-content/farm-balance';
import type { FarmChest } from '@chibi-town/game-content/farm-upgrade-catalog';
import { canStoreFarmGoods, chestInventory } from './farm-storage-logic.js';

export { FARM_PRODUCTS } from '@chibi-town/game-content/farm-balance';

import type { FarmProgress } from './farm-crop-logic.js';
import { FARM_FOOD_MS } from './farm-feeding-logic.js';
import { type FarmAnimal, type FarmUnit, farmUnitAnimals } from './farm-unit-logic.js';

export type FarmProduct = keyof typeof FARM_PRODUCTS;
export const FARM_UNITS: FarmUnit[] = ['livestock', 'poultry', 'pond'];

export function animalMaturityMs(animal: FarmAnimal) {
  return FARM_ANIMAL_CATALOG[animal.species].maturityMs;
}

export function animalProduct(animal: FarmAnimal): FarmProduct {
  return (
    FARM_ANIMAL_CATALOG[animal.species].product ??
    ({ pig: 'pork', fish: 'fish', buffalo: 'buffalo', turtle: 'turtle' } as const)[animal.species as 'pig']
  );
}

export function productCycleMs(animal: FarmAnimal) {
  return FARM_ANIMAL_CATALOG[animal.species].cycleMs;
}

/** Only time covered by food counts. Persisted timestamps permit bounded offline care.
 * One ready product per animal; collecting starts the next cycle. */
export function advanceFarmAnimals(state: FarmProgress, now: number) {
  if (!Number.isFinite(now) || now < 0) return false;
  let changed = false;
  for (const unit of FARM_UNITS) {
    const fed = state.fedAt[unit];
    for (const animal of farmUnitAnimals(state, unit)) {
      const previous = animal.careAt ?? now;
      if (previous > now) continue;
      const maturity = animalMaturityMs(animal);
      const age = animal.ageMs ?? Math.min(maturity, Math.max(0, now - animal.boughtAt));
      const elapsed =
        fed === null ? 0 : Math.max(0, Math.min(now, fed + FARM_FOOD_MS) - Math.max(previous, fed, animal.boughtAt));
      const growth = Math.min(elapsed, Math.max(0, maturity - age));
      const production = Math.min(productCycleMs(animal), (animal.productionMs ?? 0) + elapsed - growth);
      if (animal.ageMs !== age + growth || animal.productionMs !== production || animal.careAt !== now) changed = true;
      animal.ageMs = age + growth;
      animal.productionMs = production;
      animal.careAt = now;
    }
  }
  return changed;
}

export function readyFarmAnimals(state: FarmProgress, unit: FarmUnit) {
  return farmUnitAnimals(state, unit).filter(
    (a) => a.species !== 'dog' && (a.ageMs ?? 0) >= animalMaturityMs(a) && (a.productionMs ?? 0) >= productCycleMs(a),
  );
}

/** Pigs and fish are harvested once; cows, sheep and poultry remain for another cycle. */
export function collectFarmProducts(state: FarmProgress, unit: FarmUnit, now: number) {
  if (!Number.isFinite(now) || now < 0) return 0;
  advanceFarmAnimals(state, now);
  const ready = readyFarmAnimals(state, unit);
  if (!ready.length) return 0;
  const additions: Partial<Record<FarmProduct, number>> = {};
  for (const animal of ready) {
    const product = animalProduct(animal);
    additions[product] = (additions[product] ?? 0) + (FARM_ANIMAL_CATALOG[animal.species].yield || 1);
  }
  if (!canStoreFarmGoods(state, additions)) return 0;
  for (const [id, count] of Object.entries(additions))
    state.inventory[id as FarmProduct] = (state.inventory[id as FarmProduct] ?? 0) + count;
  for (const animal of ready) animal.productionMs = 0;
  const remaining = farmUnitAnimals(state, unit).filter(
    (a) => !ready.includes(a) || FARM_ANIMAL_CATALOG[a.species].product !== null,
  );
  if (unit === 'pond') state.fish = remaining;
  else if (unit === 'poultry') state.poultry = remaining;
  else state.animals = remaining;
  return ready.length;
}

export function sellFarmItem(state: FarmProgress, product: FarmProduct, count: number, chest: FarmChest = 'main') {
  const stock = chestInventory(state, chest);
  const quantity = stock[product] ?? 0;
  if (!Object.hasOwn(FARM_PRODUCTS, product) || !Number.isSafeInteger(count) || count < 1 || quantity < count)
    return false;
  const price = FARM_PRODUCTS[product].price;
  if (price === null) return false;
  const total = count * price;
  if (!Number.isSafeInteger(state.coins + total)) return false;
  stock[product] = quantity - count;
  state.coins += total;
  return true;
}

export function sellFarmAnimal(state: FarmProgress, unit: FarmUnit, index: number, now: number) {
  if (!Number.isFinite(now) || now < 0) return false;
  advanceFarmAnimals(state, now);
  const animals = farmUnitAnimals(state, unit);
  const animal = animals[index];
  if (!Number.isSafeInteger(index) || !animal || (animal.ageMs ?? 0) < animalMaturityMs(animal)) return false;
  const price = FARM_ANIMAL_CATALOG[animal.species].salePrice;
  if (!Number.isSafeInteger(state.coins + price)) return false;
  state.coins += price;
  animals.splice(index, 1);
  return true;
}

export function butcherFarmAnimal(state: FarmProgress, unit: FarmUnit, index: number, now: number) {
  if (!Number.isFinite(now) || now < 0) return false;
  advanceFarmAnimals(state, now);
  const animals = farmUnitAnimals(state, unit);
  const animal = animals[index];
  if (
    !Number.isSafeInteger(index) ||
    !animal ||
    !['cow', 'pig', 'fish'].includes(animal.species) ||
    (animal.ageMs ?? 0) < animalMaturityMs(animal)
  )
    return false;
  const product = animal.species === 'cow' ? 'beef' : animal.species === 'pig' ? 'pork' : 'fish';
  const count = (state.inventory[product] ?? 0) + 1;
  if (!canStoreFarmGoods(state, { [product]: 1 })) return false;
  state.inventory[product] = count;
  animals.splice(index, 1);
  return true;
}
