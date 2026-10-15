import type { GameSdk } from '@chibi-town/contracts';
import type { MapDefinition } from '@chibi-town/game-content';

/** Portal requests can outlive their screen; only the current owner may navigate or show errors. */
export async function navigateLocationPortal(
  portal: MapDefinition['portals'][number],
  options: {
    getWorld: GameSdk['getWorld'];
    isActive(): boolean;
    navigate(path: string): void;
    onError(): void;
  },
) {
  try {
    if (portal.target === 'world') {
      if (options.isActive()) options.navigate('/');
      return;
    }
    const world = await options.getWorld();
    if (!options.isActive()) return;
    const destination = world.maps.find((map) => map.id === portal.target);
    if (destination)
      options.navigate(`/play/${destination.regionId}/${destination.id}?spawn=${portal.spawn.join(',')}`);
  } catch {
    if (options.isActive()) options.onError();
  }
}
