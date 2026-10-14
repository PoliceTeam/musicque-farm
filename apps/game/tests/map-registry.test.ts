import { MAPS, REGIONS, validateWorld } from '@chibi-town/game-content';
import { describe, expect, it } from 'vitest';

describe('world registry', () => {
  it('keeps the eight existing region IDs and supports multiple maps per region', () => {
    expect(REGIONS.map((region) => region.id)).toEqual([
      'farm',
      'forest',
      'school',
      'center',
      'fun',
      'homes',
      'port',
      'airport',
    ]);
    const second = { ...MAPS[0], id: 'farm-second' };
    expect(() =>
      validateWorld({
        regions: REGIONS.map((region) =>
          region.id === 'farm' ? { ...region, maps: ['farm-home', 'farm-second'] } : region,
        ),
        maps: [...MAPS, second],
      }),
    ).not.toThrow();
  });
  it('rejects broken portals, duplicate map IDs, and spawn outside the map', () => {
    expect(() => validateWorld({ regions: REGIONS, maps: [...MAPS, MAPS[0]] })).toThrow();
    expect(() =>
      validateWorld({
        regions: REGIONS,
        maps: [{ ...MAPS[0], portals: [{ id: 'exit', target: 'missing', spawn: [0, 0] }] }],
      }),
    ).toThrow();
    expect(() => validateWorld({ regions: REGIONS, maps: [{ ...MAPS[0], spawn: [99999, 0] }] })).toThrow();
  });
});
