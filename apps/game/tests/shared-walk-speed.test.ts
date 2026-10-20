import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { MapDefinition } from '@chibi-town/game-content';
import { expect, it } from 'vitest';
import { createFarmWalkState, updateFarmWalk } from '@/features/farm/_utils/farm-walk-logic';
import { stepEntranceWalk } from '@/features/farm-entrance/_utils/entrance-walk-logic';
import { createLocationInputState, updateLocationInput } from '@/features/location/_utils/location-input-logic';

it.each([
  [1, 0],
  [1, 1],
] as const)('keeps farm, entrance and street travel equal for direction %s,%s', (dx, dy) => {
  const map: MapDefinition = {
    id: 'speed-check',
    regionId: 'center',
    label: '',
    scene: 'location',
    width: 1280,
    height: 720,
    spawn: [640, 594],
    portals: [],
    systems: [],
  };
  const street = createLocationInputState(map);
  const entrance = { x: 640, y: 594 };
  const farm = createFarmWalkState({ ...defaultOutfit });
  const player = farm.town.player;
  player.x = 640;
  player.y = 594;
  for (let tick = 0; tick < 4; tick++) {
    updateLocationInput(map, street, [dx, dy], 0.05, false);
    stepEntranceWalk(entrance, [dx, dy], 0.05, false);
    updateFarmWalk(farm, 0.05, [dx, dy]);
  }
  expect(Math.hypot(street.x - 640, street.y - 594)).toBeCloseTo(41);
  expect(entrance.x).toBeCloseTo(street.x);
  expect(entrance.y).toBeCloseTo(street.y);
  expect(player.x).toBeCloseTo(street.x);
  expect(player.y).toBeCloseTo(street.y);
});
