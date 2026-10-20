import { PLAYER_WALK_SPEED } from '@chibi-town/game-content/movement-config';
import { Action } from '@chibi-town/character-core/animation-logic';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { describe, expect, it } from 'vitest';
import { FARM_FEATURES, FARM_PLOTS } from '@/features/farm/_utils/farm-layout';
import { farmWalkable } from '@/features/farm/_utils/farm-path-logic';
import {
  cancelFarmWalk,
  createFarmWalkState,
  moveFarmTo,
  updateFarmWalk,
} from '@/features/farm/_utils/farm-walk-logic';

describe('farm movement simulation', () => {
  it('walks from the entrance across fields to a plot and then the pond without invalid feet positions', () => {
    const state = createFarmWalkState({ ...defaultOutfit });
    const player = state.town.player;
    for (const destination of [FARM_PLOTS[0].stand, FARM_FEATURES[3].stand, FARM_FEATURES[0].stand]) {
      moveFarmTo(state, destination);
      for (let i = 0; i < 1200 && player.target; i++) {
        updateFarmWalk(state, 0.05);
        expect(farmWalkable(player.x, player.y)).toBe(true);
      }
      expect([player.x, player.y]).toEqual(destination);
      expect(state.town.marker).toBeNull();
    }
  });
  it('keyboard movement crosses the owned crop row without stopping at plot boundaries', () => {
    const state = createFarmWalkState({ ...defaultOutfit });
    const player = state.town.player;
    player.x = 590;
    player.y = 215;
    for (let i = 0; i < 30; i++) updateFarmWalk(state, 0.05, [1, 0]);
    expect(player.x).toBeCloseTo(590 + PLAYER_WALK_SPEED * 30 * 0.05);
    expect(player.y).toBe(215);
    expect(player.avatar.action).not.toBe(Action.Stand);
    expect(farmWalkable(player.x, player.y, state.obstacles)).toBe(true);
  });
  it('keyboard cannot enter water or buildings, interrupts routes, and escape cancels movement', () => {
    const state = createFarmWalkState({ ...defaultOutfit });
    const player = state.town.player;
    player.x = 1100;
    player.y = 675;
    for (let i = 0; i < 150; i++) updateFarmWalk(state, 0.05, [0, -1]);
    expect(player.y).toBeGreaterThan(FARM_FEATURES[3].area.y1 + 6);
    expect(farmWalkable(player.x, player.y)).toBe(true);
    expect(player.avatar.action).toBe(Action.Stand);
    player.x = 185;
    player.y = 675;
    for (let i = 0; i < 150; i++) updateFarmWalk(state, 0.05, [0, -1]);
    expect(player.y).toBeGreaterThan(535);
    moveFarmTo(state, [400, 420]);
    updateFarmWalk(state, 0.05, [1, 0]);
    expect(state.route).toHaveLength(0);
    expect(player.target).toBeNull();
    moveFarmTo(state, [400, 420]);
    cancelFarmWalk(state);
    const position = [player.x, player.y];
    updateFarmWalk(state, 0.05);
    expect([player.x, player.y]).toEqual(position);
    expect(state.town.marker).toBeNull();
  });
});
