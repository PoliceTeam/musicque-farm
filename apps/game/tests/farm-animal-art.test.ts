import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { describe, expect, it } from 'vitest';
import { animalArtFrameName, animalArtStage } from '@/features/farm/_utils/animal-art';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';

const species: FarmSpecies[] = ['hen', 'duck', 'cow', 'sheep', 'pig', 'buffalo', 'turtle', 'fish', 'dog'];
describe('reference animal artwork', () => {
  it('has every source frame used by the renderers, products and shop', () => {
    for (const name of species) {
      const keys = Array.from({ length: 4 }, (_, stage) => `${name}-growth-${stage}`);
      if (name === 'fish' || name === 'turtle') {
        keys.push(`${name}-idle-0`); // Art review's mature pose.
        for (let tick = 0; tick < 8; tick++) {
          keys.push(animalArtFrameName(name, 3, 'eat', tick));
          keys.push(animalArtFrameName(name, 3, 'walk', name === 'turtle' ? 0 : tick));
        }
      } else keys.push(`${name}-idle-0`, `${name}-eat-0`);
      for (const key of keys) {
        const path = farmAssetUrl(key).replace(/^\/(?:chibi-assets|src\/assets)\//, '../src/assets/');
        expect(existsSync(fileURLToPath(new URL(path, import.meta.url))), key).toBe(true);
      }
    }
  });
  it('uses fed age for all four sizes and does not advance mature art early', () => {
    for (const name of species) {
      const maturity = FARM_ANIMAL_CATALOG[name].maturityMs;
      const animal = { species: name, boughtAt: 0, ageMs: 0 };
      for (const [fraction, stage] of [
        [0, 0],
        [1 / 6, 1],
        [1 / 3, 2],
        [0.99, 2],
        [1, 3],
        [2, 3],
      ]) {
        expect(animalArtStage({ ...animal, ageMs: maturity * fraction }, maturity * 10)).toBe(stage);
      }
      expect(animalArtStage(animal, maturity * 10)).toBe(0);
      expect(animalArtStage({ species: name, boughtAt: 100 }, 100 + maturity)).toBe(3);
    }
  });
});
