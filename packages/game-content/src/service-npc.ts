import type { ShopNpcRole } from './shop-npcs.js';
import type { MapLayer } from './world.js';

export const NPC_DISPLAY_HEIGHT = 72;

/** Reusable street service NPC: role selects art/name, service selects the menu, feet anchor to the ground. */
export function createServiceNpc({
  id,
  role,
  service,
  feet,
}: {
  id: string;
  role: ShopNpcRole;
  service: NonNullable<MapLayer['shop']>;
  feet: readonly [number, number];
}): MapLayer {
  const width = (100 * NPC_DISPLAY_HEIGHT) / 113,
    height = (130 * NPC_DISPLAY_HEIGHT) / 113;
  return {
    id,
    asset: `npc:${role}`,
    npc: role,
    npcNameplate: true,
    shop: service,
    x: feet[0] - width / 2,
    y: feet[1] - height,
    width,
    height,
    depth: feet[1],
  };
}
