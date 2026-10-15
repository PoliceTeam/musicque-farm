import type { Area } from '@/game/movement/movement-logic';

// Rendering density stays separate from the fullscreen camera zoom.
export const SCREEN = { width: 480, height: 300, scale: 2 };
// Fullscreen reveals more scenery instead of magnifying the old preview map.
export const WORLD = { width: 1280, height: 720 };
export const TOWN_ZOOM = 2;
export const TOWN_CHARACTER_SCALE = 0.75;
export const HORIZON = 72; // sky above, grass below
export const TILE = { width: 28, height: 22 };
export const FIELD = { x: 58, cols: 13, rows: [134, 158, 182, 206, 230] }; // row values are the bed baselines
export const FENCE_Y = HORIZON + 26;
export const TREE = { x: 412, y: FENCE_Y + 6 };
export const PATH_TOP = 262;
export const WALK_AREA: Area = { x0: 10, x1: WORLD.width - 10, y0: FENCE_Y + 4, y1: WORLD.height - 6 };
