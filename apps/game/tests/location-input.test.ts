import { PLAYER_WALK_SPEED } from '@chibi-town/game-content/movement-config';
import type { MapDefinition } from '@chibi-town/game-content';
import { describe, expect, it } from 'vitest';
import {
  createLocationInputState,
  locationInputAt,
  updateLocationInput,
} from '@/features/location/_utils/location-input-logic';

const map: MapDefinition = {
  systems: [],
  id: 'street',
  regionId: 'fun',
  label: 'Phố',
  scene: 'location',
  width: 800,
  height: 600,
  spawn: [100, 100],
  portals: [{ id: 'exit', target: 'world', spawn: [0, 0], entrance: [400, 550] }],
  layers: [
    {
      id: 'arcade',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      depth: 1,
      entrance: [350, 200],
      destination: { regionId: 'fun', mapId: 'hall' },
    },
  ],
};

describe('location input', () => {
  it('normalizes diagonal movement, keeps buffers, and keyboard cancels a pointer destination', () => {
    const state = createLocationInputState(map),
      position = state.position,
      delta = state.delta;
    state.target = [200, 100];
    updateLocationInput(map, state, [1, 1], 0.05, false);
    expect(Math.hypot(state.x - 100, state.y - 100)).toBeCloseTo(PLAYER_WALK_SPEED * 0.05);
    expect(state.target).toBeUndefined();
    expect(state.position).toBe(position);
    expect(state.delta).toBe(delta);
  });
  it('pauses pointer motion under dialogs then resumes and stops at the destination', () => {
    const state = createLocationInputState(map);
    state.target = [106, 100];
    updateLocationInput(map, state, undefined, 0.05, true);
    expect(state.x).toBe(100);
    expect(state.moving).toBe(false);
    updateLocationInput(map, state, undefined, 0.05, false);
    expect(state.x).toBe(106);
    updateLocationInput(map, state, undefined, 0.05, false);
    expect(state.target).toBeUndefined();
  });
  it('resolves exits and attraction entrances before normal walking', () => {
    expect(locationInputAt(map, 400, 520).kind).toBe('exit');
    expect(locationInputAt(map, 350, 225)).toMatchObject({ kind: 'attraction', destination: { mapId: 'hall' } });
    expect(locationInputAt(map, 50, 50).kind).toBe('move');
  });
});
