import { ApiSdkError } from '@chibi-town/contracts';
import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import type { FarmProgress } from '@chibi-town/gameplay';
import {
  animalMaturityMs,
  animalProduct,
  applyFarmBatch,
  butcherFarmAnimal,
  buyFarmAnimal,
  buyFarmSeeds,
  canStoreFarmGoods,
  collectFarmHerd,
  collectFarmProducts,
  collectFarmRecipe,
  cropStage,
  expandFarmUnit,
  farmAction,
  feedFarmHerd,
  feedFarmUnit,
  readyFarmAnimals,
  sellFarmAnimal,
  sellFarmItem,
  startFarmRecipe,
  transferFarmGoods,
  upgradeFarmChest,
} from '@chibi-town/gameplay';
import { farmUnitAnimals } from '@chibi-town/gameplay/farm-unit-logic';
import type { FarmCommand } from '../service-types.js';

export function executeFarmCommand(state: FarmProgress, command: FarmCommand, now: number) {
  let completed = 0,
    eligible = 1;
  switch (command.type) {
    case 'plot':
      if (
        command.action === 'harvest' &&
        state.plots[command.index] &&
        cropStage(state.plots[command.index], now) === 'ripe'
      ) {
        const id = state.plots[command.index].cropId ?? 'strawberry';
        if (!canStoreFarmGoods(state, { [id]: FARM_CROPS[id].yield })) throw new ApiSdkError('INVENTORY_FULL');
      }
      completed = Number(farmAction(state, command.index, command.action, now, command.cropId));
      break;
    case 'batch':
      ({ completed, eligible } = applyFarmBatch(state, command.action, now, command.cropId));
      if (!completed && eligible > 0 && command.action === 'harvest') throw new ApiSdkError('INVENTORY_FULL');
      break;
    case 'expand':
      completed = Number(expandFarmUnit(state, command.unit));
      break;
    case 'feed':
      completed = Number(feedFarmUnit(state, command.unit, now));
      break;
    case 'collect': {
      const additions: Parameters<typeof canStoreFarmGoods>[1] = {};
      for (const animal of readyFarmAnimals(state, command.unit)) {
        const product = animalProduct(animal);
        additions[product] = (additions[product] ?? 0) + (FARM_ANIMAL_CATALOG[animal.species].yield || 1);
      }
      if (!canStoreFarmGoods(state, additions)) throw new ApiSdkError('INVENTORY_FULL');
      completed = collectFarmProducts(state, command.unit, now);
      break;
    }
    case 'buy-animal':
      completed = Number(buyFarmAnimal(state, command.unit, command.species, now));
      break;
    case 'buy-seeds':
      completed = Number(buyFarmSeeds(state, command.count, command.cropId));
      break;
    case 'cook':
      completed = Number(startFarmRecipe(state, command.recipeId, now, command.requestId));
      break;
    case 'collect-dish': {
      const job = state.kitchen.find((job) => job.id === command.jobId);
      if (job && now >= job.readyAt && !canStoreFarmGoods(state, { [job.recipeId]: 1 }))
        throw new ApiSdkError('INVENTORY_FULL');
      completed = Number(collectFarmRecipe(state, command.jobId, now));
      break;
    }
    case 'sell-animal':
      completed = Number(
        sellFarmAnimal(
          state,
          command.unit,
          farmUnitAnimals(state, command.unit).findIndex((animal) => animal.id === command.animalId),
          now,
        ),
      );
      break;
    case 'butcher-animal': {
      const animal = farmUnitAnimals(state, command.unit).find((animal) => animal.id === command.animalId);
      if (
        animal &&
        ['cow', 'pig', 'fish'].includes(animal.species) &&
        (animal.ageMs ?? 0) >= animalMaturityMs(animal)
      ) {
        const product = animal.species === 'cow' ? 'beef' : animal.species === 'pig' ? 'pork' : 'fish';
        if (!canStoreFarmGoods(state, { [product]: 1 })) throw new ApiSdkError('INVENTORY_FULL');
      }
      completed = Number(
        butcherFarmAnimal(
          state,
          command.unit,
          farmUnitAnimals(state, command.unit).findIndex((animal) => animal.id === command.animalId),
          now,
        ),
      );
      break;
    }
    case 'upgrade-chest':
      completed = Number(upgradeFarmChest(state, command.chest));
      break;
    case 'transfer-goods':
      if (!canStoreFarmGoods(state, { [command.product]: command.count }, command.from === 'main' ? 'home' : 'main'))
        throw new ApiSdkError('INVENTORY_FULL');
      completed = Number(transferFarmGoods(state, command.from, command.product, command.count));
      break;
    case 'sell':
      completed = Number(sellFarmItem(state, command.product, command.count, command.chest));
      break;
    case 'feed-all':
      completed = feedFarmHerd(state, now);
      break;
    case 'collect-all':
      completed = collectFarmHerd(state, now);
      if (
        !completed &&
        ['livestock', 'poultry', 'pond'].some(
          (unit) => readyFarmAnimals(state, unit as 'livestock' | 'poultry' | 'pond').length > 0,
        )
      )
        throw new ApiSdkError('INVENTORY_FULL');
      break;
    default:
      throw new ApiSdkError('INVALID_COMMAND');
  }
  return { completed, eligible };
}
