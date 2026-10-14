import type { FarmProgress } from './farm-crop-logic.js';

/** Invalidate scenery when capacity markers or same-size herds change. */
export function farmLayoutSignature(state: FarmProgress) {
  return JSON.stringify([
    state.units.livestock,
    state.units.pond,
    state.capacity.livestock,
    state.capacity.poultry,
    state.capacity.pond,
    ...[state.animals, state.poultry, state.fish].map((animals) =>
      animals.map((animal) => [animal.id, animal.species, animal.boughtAt]),
    ),
  ]);
}
