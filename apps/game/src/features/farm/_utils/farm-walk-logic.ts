import { Action } from '@chibi-town/character-core/animation-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import {
  FARM_SPAWN,
  FARM_WALK_AREA,
  type FarmPoint,
  type FarmUnitLevels,
  farmFeaturesFor,
  farmObstaclesFor,
} from '@/features/farm/_utils/farm-layout';
import { farmRoute, farmSegmentClear } from '@/features/farm/_utils/farm-path-logic';
import { type Area, stepWalker } from '@/game/movement/movement-logic';
import { stepPet } from '@/game/movement/pet-follow-logic';
import { createTownState, type TownState, updateTownEffects } from '@/game/movement/town-logic';

export type FarmWalkState = { town: TownState; route: FarmPoint[]; obstacles: Area[] };

export function createFarmWalkState(
  outfit: Outfit,
  levels: FarmUnitLevels = { livestock: 0, pond: 0 },
  identity?: { name: string; level: number },
): FarmWalkState {
  const town = createTownState(outfit, identity);
  town.residents = [town.player];
  const player = town.player;
  [player.x, player.y] = FARM_SPAWN;
  player.speed = 78;
  if (player.pet) {
    player.pet.x = player.x - 24;
    player.pet.y = player.y;
  }
  return { town, route: [], obstacles: farmObstaclesFor(farmFeaturesFor(levels)) };
}

export function cancelFarmWalk(state: FarmWalkState) {
  state.route = [];
  state.town.player.target = null;
  state.town.marker = null;
  state.town.player.avatar.setAction(Action.Stand);
}

export function moveFarmTo(state: FarmWalkState, requested: FarmPoint) {
  const player = state.town.player;
  state.route = farmRoute([player.x, player.y], requested, state.obstacles);
  player.target = state.route.shift() ?? null;
  state.town.marker = null;
}

export function updateFarmWalk(state: FarmWalkState, dt: number, direction: FarmPoint = [0, 0]) {
  const player = state.town.player;
  dt = Math.min(0.05, Math.max(0, dt));
  if (direction[0] || direction[1]) {
    state.route = [];
    state.town.marker = null;
  }
  const before: FarmPoint = [player.x, player.y];
  const arrived = stepWalker(player, dt, FARM_WALK_AREA, direction);
  if (!farmSegmentClear(before, [player.x, player.y], state.obstacles)) {
    const proposed: FarmPoint = [player.x, player.y];
    [player.x, player.y] = before;
    if (direction[0] || direction[1]) {
      if (farmSegmentClear(before, [proposed[0], before[1]], state.obstacles)) player.x = proposed[0];
      if (farmSegmentClear([player.x, player.y], [player.x, proposed[1]], state.obstacles)) player.y = proposed[1];
    } else cancelFarmWalk(state);
    if (player.x === before[0] && player.y === before[1]) player.avatar.setAction(Action.Stand);
  }
  if (arrived) {
    player.target = state.route.shift() ?? null;
    if (!player.target) state.town.marker = null;
  }
  const pet = player.pet;
  if (pet) {
    const old: FarmPoint = [pet.x, pet.y];
    stepPet(pet, { x: player.x, y: player.y, speed: player.speed, mirror: player.avatar.mirror }, dt);
    if (!farmSegmentClear(old, [pet.x, pet.y], state.obstacles)) {
      [pet.x, pet.y] = old;
      pet.moving = false;
    }
  }
  updateTownEffects(state.town);
}
