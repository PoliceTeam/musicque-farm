import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { FARM_ANIMALS, farmAnimalStage } from '@chibi-town/game-content/farm-animal-logic';
import { createFarmProgress, parseFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { describe, expect, it } from 'vitest';
import { farmRoamPose } from '@/features/farm/_utils/farm-herd-logic';
import { farmUnitArea } from '@/features/farm/_utils/farm-layout';

describe('animal life and roaming', () => {
  it('grows once through three stages and retains age across saved sessions', () => {
    for (const species of [...new Set(FARM_ANIMALS), 'fish'] as const) {
      expect(farmAnimalStage(species, 0, 0)).toBe(0);
      expect(farmAnimalStage(species, 0, FARM_ANIMAL_CATALOG[species].maturityMs / 2)).toBe(1);
      expect(farmAnimalStage(species, 0, FARM_ANIMAL_CATALOG[species].maturityMs)).toBe(2);
      expect(farmAnimalStage(species, 0, FARM_ANIMAL_CATALOG[species].maturityMs * 2)).toBe(2);
    }
    const saved = createFarmProgress();
    saved.animalStartedAt = 1000;
    expect(parseFarmProgress(JSON.parse(JSON.stringify(saved))).animalStartedAt).toBe(1000);
    const { animalStartedAt: _, ...legacy } = saved;
    expect(parseFarmProgress(legacy).animalStartedAt).toBeNull();
    expect(parseFarmProgress({ ...saved, animalStartedAt: -1 }).animalStartedAt).toBeNull();
  });
  it('keeps the entire animal clear of fences, shelter and troughs at every expansion', () => {
    for (const level of [0, 1, 2] as const) {
      const a = farmUnitArea('livestock', level);
      const safe = { x0: a.x0 + 34, x1: a.x1 - 34, y0: a.y0 + 125, y1: a.y1 - 53 };
      for (let i = 0; i < FARM_ANIMALS.length; i++) {
        let moved = false;
        const start = farmRoamPose(safe, i, 0);
        for (let t = 0; t < 180000; t += 173) {
          const p = farmRoamPose(safe, i, t);
          expect(p.x - 26).toBeGreaterThan(a.x0);
          expect(p.x + 26).toBeLessThan(a.x1);
          expect(p.y - 44).toBeGreaterThan(a.y0 + 80);
          expect(p.y + 4).toBeLessThan(a.y1 - 40);
          if (Math.hypot(p.x - start.x, p.y - start.y) > 40) moved = true;
        }
        expect(moved).toBe(true);
      }
    }
  });
});
