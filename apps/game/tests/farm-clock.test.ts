import { FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { cropStage } from '@chibi-town/gameplay';
import { expect, it } from 'vitest';
import { farmTimeAt } from '@/features/farm/_utils/farm-clock-logic';

it('lets a selected crop become harvestable without replacing the unchanged snapshot', () => {
  const crop = { stage: 'growing' as const, cropId: 'tomato' as const, wateredAt: 1 };
  const server = 1 + FARM_CROPS.tomato.growMs - 1000;
  const anchor = { server, real: 10000 };
  expect(cropStage(crop, farmTimeAt(anchor, 10000, 1))).toBe('growing');
  expect(cropStage(crop, farmTimeAt(anchor, 11000, 1))).toBe('ripe');
  expect(crop.stage).toBe('growing');
  expect(farmTimeAt(anchor, 9000, 1)).toBe(server);
  expect(farmTimeAt(anchor, 10500, 2)).toBe(server + 1000);
});
