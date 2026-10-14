import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { describe, expect, it } from 'vitest';
import {
  CROP_GROWTH_FRAMES,
  cropAssetName,
  cropGrowthFrame,
  cropIconUrl,
} from '@/features/farm/_utils/crop-growth-frames';
import { farmAssetUrl } from '@/features/farm/_utils/farm-assets';

describe('crop reference artwork', () => {
  it('resolves every planted stage and warehouse icon without basename collisions', () => {
    for (const id of Object.keys(FARM_CROPS) as CropId[]) {
      for (let frame = 0; frame <= CROP_GROWTH_FRAMES[id].ripe; frame++) {
        const name = cropAssetName(id, frame);
        const path = farmAssetUrl(name).replace(/^\/(?:chibi-assets|src\/assets)\//, '../src/assets/');
        expect(existsSync(fileURLToPath(new URL(path, import.meta.url))), name).toBe(true);
      }
      const icon = cropIconUrl(id).replace(/^\/(?:chibi-assets|src\/assets)\//, '../src/assets/');
      expect(existsSync(fileURLToPath(new URL(icon, import.meta.url))), icon).toBe(true);
    }
  });
  it('holds the ripe image until harvest time across the different reference sequence lengths', () => {
    for (const id of Object.keys(FARM_CROPS) as CropId[]) {
      expect(cropGrowthFrame(id, 0)).toBe(0);
      expect(cropGrowthFrame(id, 0.9999)).toBe(CROP_GROWTH_FRAMES[id].ripe - 1);
    }
  });
});
