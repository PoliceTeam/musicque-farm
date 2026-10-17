import { MAPS, REGIONS, validateWorld } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { sceneryUrls, shoppingUrls } from '@/assets/generated-assets';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';

const map = MAPS.find((entry) => entry.id === 'shopping-street')!;

it('opens the shared shopping street from Center with all six supplied shops registered', () => {
  expect(REGIONS.find((region) => region.id === 'center')?.maps).toContain(map.id);
  expect(() => validateWorld({ regions: REGIONS, maps: MAPS })).not.toThrow();
  expect(map.presentation).toBe('street');
  expect(map.channels).toEqual({ count: 40, capacity: 30 });
  const buildings = map.layers!.filter((layer) => layer.asset?.startsWith('shopping:'));
  expect(buildings).toHaveLength(6);
  for (const layer of buildings) {
    expect(shoppingUrls[layer.asset!]).toBeTruthy();
    expect(layer.y + layer.height).toBeCloseTo(545);
    if (layer.id === 'salon') {
      expect(layer.destination).toEqual({ regionId: 'center', mapId: 'salon' });
      expect(locationInputAt(map, layer.x + layer.width / 2, 565).kind).toBe('destination');
    } else if (layer.id === 'premium') {
      expect(locationInputAt(map, layer.x + layer.width / 2, 565)).toEqual({ kind: 'shop', shop: 'premium' });
    } else {
      expect(layer.destination).toBeUndefined();
      expect(locationInputAt(map, layer.x + layer.width / 2, 565).kind).toBe('move');
    }
  }
  for (const layer of map.layers!.filter((layer) => layer.asset?.startsWith('scenery:')))
    expect(sceneryUrls[layer.asset!]).toBeTruthy();
});

it('keeps the plaza and exit reachable while blocking roads, storefronts and bus-stop feet', () => {
  expect(moveInLocation(map, map.spawn, [60, 0])).toEqual([840, 780]);
  expect(moveInLocation(map, [780, 780], [0, 300])[1]).toBeLessThanOrEqual(825);
  expect(moveInLocation(map, [780, 590], [0, -300])[1]).toBeGreaterThanOrEqual(554);
  expect(moveInLocation(map, [1000, 800], [0, -100])[1]).toBeGreaterThanOrEqual(770);
  const exit = map.portals[0];
  expect(exit.target).toBe('world');
  expect(locationInputAt(map, ...exit.entrance!)).toEqual({ kind: 'exit' });
  expect(moveInLocation(map, exit.entrance!, [0, -20])).toEqual([1040, 803]);
});
