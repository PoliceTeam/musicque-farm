import { FARM_STARTING_COINS, FARM_UNIT_SAVE_LIMITS } from '@chibi-town/game-content/farm-balance';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { landUpgradePrice } from '@chibi-town/game-content/farm-upgrade-catalog';
import { type KitchenJob, parseKitchenJobs } from './farm-kitchen-logic.js';
import { type ChestLevel, canStoreFarmGoods, parseChestLevel } from './farm-storage-logic.js';

export { FARM_GROW_MS } from '@chibi-town/game-content/farm-balance';

import { FARM_ANIMALS } from '@chibi-town/game-content/farm-animal-logic';
import { FARM_PLOT_LIMIT } from '@chibi-town/game-content/farm-land-config';

type FarmUnitLevels = { livestock: 0 | 1 | 2; pond: 0 | 1 | 2 };

import { FARM_PRODUCTS, type FarmProduct } from './farm-product-logic.js';
import {
  type FARM_UNIT_LIMITS,
  FARM_UNIT_START,
  type FarmAnimal,
  farmUnitLevel,
  isFreeAnimal,
} from './farm-unit-logic.js';
/** Serializable farm simulation. Time is supplied by the caller, in milliseconds. */
export type CropStage = 'dry' | 'tilled' | 'seeded' | 'growing' | 'ripe';
export type FarmCrop = { stage: CropStage; wateredAt: number | null; cropId?: CropId; stolen?: boolean };
export type FarmProgress = {
  version: 1;
  coins: number;
  gems: number;
  chests: { main: ChestLevel; home: ChestLevel };
  homeInventory: Partial<Record<FarmProduct, number>>;
  seeds: Partial<Record<CropId, number>>;
  kitchen: KitchenJob[];
  harvested: number;
  owned: number;
  units: FarmUnitLevels;
  capacity: { livestock: number; poultry: number; pond: number };
  inventory: { strawberry: number; seed: number } & Partial<Record<FarmProduct, number>>;
  poultry: FarmAnimal[];
  animals: FarmAnimal[];
  fish: FarmAnimal[];
  plots: FarmCrop[];
  animalStartedAt: number | null;
  fedAt: { livestock: number | null; poultry: number | null; pond: number | null };
};
export type FarmAction = 'till' | 'sow' | 'water' | 'harvest' | 'buy';

export function createFarmProgress(): FarmProgress {
  return {
    version: 1,
    gems: 0,
    chests: { main: 1, home: 1 },
    homeInventory: {},
    seeds: {},
    kitchen: [],
    animalStartedAt: null,
    fedAt: { livestock: null, poultry: null, pond: null },
    inventory: { strawberry: 0, seed: 0 },
    poultry: [],
    units: { livestock: 0, pond: 0 },
    capacity: { ...FARM_UNIT_START },
    animals: [],
    fish: [],
    coins: FARM_STARTING_COINS,
    harvested: 0,
    owned: 6,
    plots: Array.from({ length: FARM_PLOT_LIMIT }, () => ({ stage: 'dry', wateredAt: null })),
  };
}

export function cropStage(crop: FarmCrop, now: number): CropStage {
  return crop.stage === 'growing' &&
    crop.wateredAt !== null &&
    now - crop.wateredAt >= FARM_CROPS[crop.cropId ?? 'strawberry'].growMs
    ? 'ripe'
    : crop.stage;
}

export function farmLandPrice(owned: number) {
  return landUpgradePrice(owned);
}

export function farmAction(
  state: FarmProgress,
  index: number,
  action: FarmAction,
  now: number,
  cropId: CropId = 'strawberry',
): boolean {
  if (!Number.isFinite(now) || now < 0 || !Object.hasOwn(FARM_CROPS, cropId)) return false;
  if (!Number.isInteger(index) || index < 0 || index >= FARM_PLOT_LIMIT) return false;
  if (action === 'buy') {
    const price = farmLandPrice(state.owned);
    if (index !== state.owned || state.owned >= FARM_PLOT_LIMIT || state.coins < price) return false;
    state.coins -= price;
    state.owned++;
    return true;
  }
  if (index >= state.owned) return false;
  const crop = state.plots[index];
  const stage = cropStage(crop, now);
  if (action === 'till' && stage === 'dry') crop.stage = 'tilled';
  else if (action === 'sow' && stage === 'tilled') {
    const definition = FARM_CROPS[cropId];
    const seedCount = cropId === 'strawberry' ? state.inventory.seed : (state.seeds[cropId] ?? 0);
    if (seedCount > 0) {
      if (cropId === 'strawberry') state.inventory.seed--;
      else state.seeds[cropId] = seedCount - 1;
    } else {
      if (state[definition.currency] < definition.seedPrice) return false;
      state[definition.currency] -= definition.seedPrice;
    }
    crop.cropId = cropId;
    delete crop.stolen;
    crop.stage = 'seeded';
  } else if (action === 'water' && stage === 'seeded') {
    crop.stage = 'growing';
    crop.wateredAt = now;
  } else if (action === 'harvest' && stage === 'ripe') {
    const id = crop.cropId ?? 'strawberry';
    const harvestYield = FARM_CROPS[id].yield - (crop.stolen ? 1 : 0);
    const quantity = (state.inventory[id] ?? 0) + harvestYield;
    if (!canStoreFarmGoods(state, { [id]: harvestYield })) return false;
    state.inventory[id] = quantity;
    crop.stage = 'tilled';
    delete crop.cropId;
    delete crop.stolen;
    crop.wateredAt = null;
    state.harvested++;
  } else return false;
  return true;
}

export function parseFarmProgress(value: unknown, invalid: () => FarmProgress = createFarmProgress): FarmProgress {
  if (!value || typeof value !== 'object') return invalid();
  const v = value as Partial<FarmProgress>;
  if (
    v.version !== 1 ||
    !Number.isInteger(v.owned) ||
    v.owned! < 6 ||
    v.owned! > FARM_PLOT_LIMIT ||
    !Number.isInteger(v.coins) ||
    v.coins! < 0 ||
    !Number.isInteger(v.harvested) ||
    v.harvested! < 0 ||
    !Array.isArray(v.plots) ||
    (v.plots.length !== 48 && v.plots.length !== FARM_PLOT_LIMIT) ||
    v.owned! > v.plots.length
  )
    return invalid();
  if (
    !v.plots.every(
      (p) =>
        p &&
        ['dry', 'tilled', 'seeded', 'growing', 'ripe'].includes(p.stage) &&
        (p.wateredAt === null ||
          (typeof p.wateredAt === 'number' && Number.isFinite(p.wateredAt) && p.wateredAt >= 0)) &&
        (p.stage !== 'growing' || p.wateredAt !== null) &&
        (p.cropId === undefined || Object.hasOwn(FARM_CROPS, p.cropId)),
    )
  )
    return invalid();
  const oldLevels = { livestock: validLevel(v.units?.livestock), pond: validLevel(v.units?.pond) };
  const migrated = v.capacity === undefined && v.animals === undefined && v.fish === undefined;
  const animals: FarmAnimal[] = migrated
    ? FARM_ANIMALS.map((species, i) => ({
        species,
        boughtAt: Math.max(0, (v.animalStartedAt ?? 0) - (i % 3) * (['hen', 'duck'].includes(species) ? 3 : 5) * 90000),
      }))
    : v.animals!;
  const fish: FarmAnimal[] = migrated
    ? Array.from({ length: 5 + oldLevels.pond * 2 }, (_, i) => ({
        species: 'fish',
        boughtAt: Math.max(0, (v.animalStartedAt ?? 0) - (i % 3) * 4 * 90000),
      }))
    : v.fish!;
  if (
    !validAnimals(animals, false) ||
    !validAnimals(fish, true) ||
    (v.poultry !== undefined && !validAnimals(v.poultry, false))
  )
    return invalid();
  const rawCapacity: Partial<FarmProgress['capacity']> = migrated
    ? {
        livestock: oldLevels.livestock === 2 ? 24 : Math.max(15, oldLevels.livestock === 1 ? 10 : 6),
        pond: oldLevels.pond === 2 ? 20 : oldLevels.pond === 1 ? 10 : 5,
      }
    : v.capacity!;
  const poultry = [...(v.poultry ?? []), ...animals.filter((a) => isFreeAnimal(a.species))];
  const penned = animals.filter((a) => !isFreeAnimal(a.species));
  const capacity = rawCapacity && {
    livestock:
      Number.isInteger(rawCapacity.livestock) && rawCapacity.livestock! >= 6
        ? Math.max(FARM_UNIT_START.livestock, rawCapacity.livestock!)
        : rawCapacity.livestock!,
    pond: rawCapacity.pond!,
    poultry: rawCapacity.poultry ?? Math.max(6, poultry.length),
  };
  const inventory = v.inventory ?? { strawberry: 0, seed: 0 };
  if (
    !validAnimals(animals, false) ||
    !validAnimals(fish, true) ||
    !validAnimals(poultry, false) ||
    poultry.some((a) => !isFreeAnimal(a.species)) ||
    !inventory ||
    ![inventory.strawberry, inventory.seed].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    !capacity ||
    !['livestock', 'poultry', 'pond'].every((unit) => {
      const key = unit as keyof typeof FARM_UNIT_LIMITS,
        count = capacity[key];
      return (
        Number.isInteger(count) &&
        count >= FARM_UNIT_START[key] &&
        count <= FARM_UNIT_SAVE_LIMITS[key] &&
        (key === 'livestock' ? penned.length : key === 'poultry' ? poultry.length : fish.length) <= count
      );
    })
  )
    return invalid();
  return {
    version: 1,
    animalStartedAt:
      typeof v.animalStartedAt === 'number' && Number.isFinite(v.animalStartedAt) && v.animalStartedAt >= 0
        ? v.animalStartedAt
        : null,
    chests: { main: parseChestLevel(v.chests?.main), home: parseChestLevel(v.chests?.home) },
    homeInventory: Object.fromEntries(
      Object.keys(FARM_PRODUCTS)
        .filter(
          (id) =>
            Number.isSafeInteger(v.homeInventory?.[id as FarmProduct]) && v.homeInventory![id as FarmProduct]! > 0,
        )
        .map((id) => [id, v.homeInventory![id as FarmProduct]]),
    ),
    gems: Number.isSafeInteger(v.gems) && v.gems! >= 0 ? v.gems! : 0,
    seeds: Object.fromEntries(
      Object.keys(FARM_CROPS)
        .filter((id) => Number.isSafeInteger(v.seeds?.[id as CropId]) && v.seeds![id as CropId]! > 0)
        .map((id) => [id, v.seeds![id as CropId]]),
    ),
    kitchen: parseKitchenJobs(v.kitchen),
    capacity: { ...capacity },
    inventory: {
      strawberry: inventory.strawberry,
      seed: inventory.seed,
      ...Object.fromEntries(
        Object.keys(FARM_PRODUCTS)
          .filter((id) => Object.hasOwn(inventory, id))
          .map((id) => {
            const n = inventory[id as FarmProduct];
            return [id, Number.isSafeInteger(n) && n! >= 0 ? n : 0];
          }),
      ),
    },
    poultry: poultry.map((a, index) => ({ ...a, id: a.id ?? `poultry:${index}:${a.boughtAt}` })),
    animals: penned.map((a, index) => ({ ...a, id: a.id ?? `livestock:${index}:${a.boughtAt}` })),
    fish: fish.map((a, index) => ({ ...a, id: a.id ?? `pond:${index}:${a.boughtAt}` })),
    units: { livestock: farmUnitLevel('livestock', capacity.livestock), pond: farmUnitLevel('pond', capacity.pond) },
    fedAt: {
      poultry: validTimestamp(v.fedAt?.poultry === undefined ? v.fedAt?.livestock : v.fedAt.poultry),
      livestock: validTimestamp(v.fedAt?.livestock),
      pond: validTimestamp(v.fedAt?.pond),
    },
    owned: v.owned!,
    coins: v.coins!,
    harvested: v.harvested!,
    plots: Array.from({ length: FARM_PLOT_LIMIT }, (_, index) => {
      const p = v.plots![index];
      return p
        ? {
            stage: p.stage,
            wateredAt: p.wateredAt,
            ...(p.cropId ? { cropId: p.cropId } : {}),
            ...(p.stolen === true ? { stolen: true } : {}),
          }
        : { stage: 'dry', wateredAt: null };
    }),
  };
}

function validLevel(value: unknown): 0 | 1 | 2 {
  return value === 1 || value === 2 ? value : 0;
}

function validAnimals(value: unknown, fish: boolean): value is FarmAnimal[] {
  return (
    Array.isArray(value) &&
    value.length <= (fish ? 20 : 24) &&
    value.every(
      (a) =>
        a &&
        (fish
          ? ['fish', 'turtle'].includes(a.species)
          : ['cow', 'pig', 'sheep', 'hen', 'duck', 'buffalo', 'dog'].includes(a.species)) &&
        (a.id === undefined || (typeof a.id === 'string' && a.id.length > 0)) &&
        typeof a.boughtAt === 'number' &&
        Number.isFinite(a.boughtAt) &&
        a.boughtAt >= 0 &&
        [a.ageMs, a.careAt, a.productionMs].every((n) => n === undefined || (Number.isFinite(n) && n >= 0)),
    )
  );
}

function validTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
