import { MAPS, REGIONS } from '@chibi-town/game-content';
import { describe, expect, it } from 'vitest';
import { entertainmentUrls } from '@/assets/generated-assets';
import { moveInLocation } from '@/features/location/_utils/location-logic';

const map = MAPS.find((entry) => entry.id === 'entertainment-street')!;
describe('entertainment street', () => {
  it('opens from the entertainment region with resolvable artwork and an exit', () => {
    expect(REGIONS.find((region) => region.id === 'fun')?.maps).toContain(map.id);
    for (const layer of map.layers ?? []) {
      if (
        layer.asset &&
        !['entertainment:plaza', 'entertainment:wires', 'entertainment:garden', 'entertainment:sky'].includes(
          layer.asset,
        )
      )
        expect(entertainmentUrls[layer.asset]).toBeTruthy();
    }
    expect(map.portals.some((portal) => portal.target === 'world')).toBe(true);
  });
  it('provides a visible exit on the walkable plaza separate from its world destination', () => {
    const exit = map.portals.find((portal) => portal.target === 'world')!;
    expect(exit.entrance).toBeDefined();
    expect(exit.entrance).not.toEqual(exit.spawn);
    expect(moveInLocation(map, exit.entrance!, [0, -20])).toEqual([exit.entrance![0], exit.entrance![1] - 20]);
  });
  it('lets the player leave spawn while blocking the road and shop row', () => {
    expect(moveInLocation(map, map.spawn, [80, 0])).toEqual([880, 780]);
    expect(moveInLocation(map, map.spawn, [0, 300])[1]).toBeLessThanOrEqual(825);
    expect(moveInLocation(map, [550, 590], [0, -300])[1]).toBeGreaterThanOrEqual(554);
  });
  it('blocks billboard feet while leaving its side passage open', () => {
    expect(moveInLocation(map, [800, 800], [0, -100])[1]).toBeGreaterThanOrEqual(766);
    expect(moveInLocation(map, [590, 800], [0, -100])).toEqual([590, 700]);
    expect(map.layers?.find((layer) => layer.id === 'wheel-disc')?.rotationSeconds).toBeGreaterThan(0);
    expect(map.layers?.find((layer) => layer.id === 'wheel-pointer')?.rotationSeconds).toBeUndefined();
  });
});
