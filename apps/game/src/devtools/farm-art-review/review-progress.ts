import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { CROP_IDS } from '@chibi-town/game-content/farm-catalog';
import { createFarmProgress, type FarmUnit } from '@chibi-town/gameplay';
import { FARM_PLOTS } from '@/features/farm/_utils/farm-layout';

const SPECIES: Record<FarmUnit, FarmSpecies[]> = {
  livestock: ['cow', 'pig', 'sheep'],
  poultry: ['hen', 'duck'],
  pond: ['fish'],
};

export function reviewProgress(mode: string | null) {
  const state = createFarmProgress();
  if (mode === 'max' || mode === 'storage') {
    state.owned = FARM_PLOTS.length;
    state.capacity = { livestock: 20, poultry: 24, pond: 10 };
    state.units = { livestock: 2, pond: 2 };
    for (const unit of ['livestock', 'poultry', 'pond'] as const) {
      const animals = Array.from({ length: state.capacity[unit] }, (_, index) => ({
        species: SPECIES[unit][index % SPECIES[unit].length],
        boughtAt: Date.now() - 259200000,
        ageMs: 259200000,
        productionMs: 43200000,
      }));
      if (unit === 'livestock') state.animals = animals;
      else if (unit === 'poultry') state.poultry = animals;
      else state.fish = animals;
    }
    state.inventory = { strawberry: 12, seed: 8, rice: 1440, egg: 20, tomato: 1000 };
    state.gems = mode === 'storage' ? 1000 : 20;
    if (mode === 'storage') state.coins = 1_000_000;
    state.seeds = { tomato: 8, chili: 4 };
    state.animalStartedAt = Date.now();
    state.plots.forEach((plot) => {
      plot.stage = 'ripe';
    });
  }
  if (mode === 'crops') {
    state.owned = 24;
    state.chests.main = 3;
    state.plots.slice(0, 24).forEach((plot, i) => {
      plot.stage = 'ripe';
      plot.cropId = CROP_IDS[i % CROP_IDS.length];
    });
    for (const id of CROP_IDS) state.inventory[id] = 10;
  }
  if (mode === 'timers') {
    const now = Date.now();
    state.coins = 200000;
    state.animalStartedAt = now;
    state.fedAt = { livestock: now, poultry: now, pond: now };
    state.plots.slice(0, 6).forEach((plot, i) => {
      plot.cropId = 'tomato';
      plot.stage = 'growing';
      plot.wateredAt = now - (i === 0 ? 14400000 - 5000 : i === 1 ? 14400000 : 7200000);
    });
    state.poultry = [
      { species: 'hen', boughtAt: now - 86400000, careAt: now, ageMs: 86400000, productionMs: 21600000 - 5000 },
      { species: 'hen', boughtAt: now, careAt: now, ageMs: 43200000, productionMs: 0 },
      { species: 'duck', boughtAt: now, careAt: now, ageMs: 0, productionMs: 0 },
    ];
    state.animals = [{ species: 'cow', boughtAt: now, careAt: now, ageMs: 129600000, productionMs: 0 }];
    state.fish = [{ species: 'fish', boughtAt: now, careAt: now, ageMs: 129600000, productionMs: 0 }];
  }
  return state;
}
