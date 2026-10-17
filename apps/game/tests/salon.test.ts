import { MAPS, REGIONS, validateWorld } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { npcUrls, salonUrls } from '@/assets/generated-assets';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { moveInLocation } from '@/features/location/_utils/location-logic';

const salon = MAPS.find((map) => map.id === 'salon')!;

it('opens the salon counter as a shop and returns to the shopping street through its exit', () => {
  expect(() => validateWorld({ regions: REGIONS, maps: MAPS })).not.toThrow();
  expect(salon.presentation).toBe('interior');
  expect(locationInputAt(salon, 820, 400)).toEqual({ kind: 'shop', shop: 'salon' });
  expect(salon.layers?.find((layer) => layer.shop === 'salon')?.shopInteraction).toEqual([800, 570]);
  expect(locationInputAt(salon, 800, 545)).toEqual({ kind: 'shop', shop: 'salon' });
  expect(locationInputAt(salon, 800, 915)).toEqual({ kind: 'portal', portal: salon.portals[0] });
  expect(salon.portals[0]).toMatchObject({ target: 'shopping-street', spawn: [165, 580] });
  expect(moveInLocation(salon, salon.spawn, [0, 80])).toEqual([800, 890]);
  expect(moveInLocation(salon, [800, 550], [0, -100])[1]).toBeGreaterThanOrEqual(500);
  for (const layer of salon.layers ?? [])
    if (layer.asset) expect(salonUrls[layer.asset] ?? npcUrls[layer.asset]).toBeTruthy();
});
