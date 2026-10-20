import type { MapDefinition } from '@chibi-town/game-content';
import { moveInLocation } from '@/features/location/_utils/location-logic';
import type { Pet } from '@/game/movement/pet-follow-logic';
import { serviceNpcAt } from '@/game/npc/service-npc-logic';
import { LOCATION_WALK_SPEED } from '@/game/runtime/game-config';

const attractionIds = ['atm', 'arcade', 'hall', 'auction', 'prizes', 'racing'] as const;
export type Attraction = (typeof attractionIds)[number];
export type LocationInputState = {
  pet?: Pet;
  x: number;
  y: number;
  target?: [number, number];
  dx: number;
  moving: boolean;
  position: [number, number];
  delta: [number, number];
};

export function createLocationInputState(map: MapDefinition): LocationInputState {
  return { x: map.spawn[0], y: map.spawn[1], dx: 0, moving: false, position: [...map.spawn], delta: [0, 0] };
}

export function updateLocationInput(
  map: MapDefinition,
  state: LocationInputState,
  direction: readonly [number, number] | undefined,
  seconds: number,
  blocked: boolean,
) {
  let dx = direction?.[0] ?? 0,
    dy = direction?.[1] ?? 0;
  if (blocked) {
    dx = 0;
    dy = 0;
  } else if (dx || dy) state.target = undefined;
  else if (state.target) {
    dx = state.target[0] - state.x;
    dy = state.target[1] - state.y;
    if (Math.hypot(dx, dy) < 3) {
      state.target = undefined;
      dx = 0;
      dy = 0;
    }
  }
  const distance = Math.hypot(dx, dy);
  if (distance) {
    const travel = state.target ? Math.min(distance, LOCATION_WALK_SPEED * seconds) : LOCATION_WALK_SPEED * seconds;
    state.position[0] = state.x;
    state.position[1] = state.y;
    state.delta[0] = (dx / distance) * travel;
    state.delta[1] = (dy / distance) * travel;
    moveInLocation(map, state.position, state.delta, state.position);
    state.x = state.position[0];
    state.y = state.position[1];
  }
  state.dx = dx;
  state.moving = distance > 0;
}

export function locationInputAt(map: MapDefinition, x: number, y: number) {
  const sign = map.layers?.find((layer) => layer.id === 'zone-sign');
  if (map.channels && sign && x >= sign.x && x <= sign.x + sign.width && y >= sign.y && y <= sign.y + sign.height)
    return { kind: 'channels' } as const;
  for (const portal of map.portals)
    if (
      portal.entrance &&
      Math.abs(x - portal.entrance[0]) <= 36 &&
      y >= portal.entrance[1] - 52 &&
      y <= portal.entrance[1] + 12
    )
      return portal.target === 'world' ? ({ kind: 'exit' } as const) : ({ kind: 'portal', portal } as const);
  const npc = serviceNpcAt(map.layers ?? [], x, y);
  if (npc) return { kind: 'shop', shop: npc.shop! } as const;
  for (const layer of map.layers ?? []) {
    if (!layer.shop && !layer.destination) continue;
    if (map.regionId === 'fun' && !layer.shop && attractionIds.includes(layer.id as Attraction)) continue;
    if (
      (x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height) ||
      (layer.shopInteraction &&
        Math.abs(x - layer.shopInteraction[0]) <= 32 &&
        y >= layer.shopInteraction[1] - 52 &&
        y <= layer.shopInteraction[1] + 4) ||
      (layer.entrance && Math.abs(x - layer.entrance[0]) <= 28 && y >= layer.entrance[1] && y <= layer.entrance[1] + 44)
    ) {
      if (layer.shop) return { kind: 'shop', shop: layer.shop } as const;
      return { kind: 'destination', destination: layer.destination! } as const;
    }
  }
  if (map.regionId === 'fun')
    for (const layer of map.layers ?? []) {
      if (
        (attractionIds.includes(layer.id as Attraction) || layer.id.startsWith('wheel-')) &&
        ((x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height) ||
          (layer.entrance &&
            Math.abs(x - layer.entrance[0]) <= 28 &&
            y >= layer.entrance[1] &&
            y <= layer.entrance[1] + 44))
      )
        return {
          kind: 'attraction',
          id: layer.id.startsWith('wheel-') ? 'prizes' : (layer.id as Attraction),
          destination: layer.destination,
        } as const;
    }
  return { kind: 'move' } as const;
}
