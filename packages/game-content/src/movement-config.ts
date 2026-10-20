/** Shared player travel speed in world units per second across gameplay areas. */
export const PLAYER_WALK_SPEED = 205;
export const LOCATION_WALK_SPEED = PLAYER_WALK_SPEED;
/** Retain a 20% server allowance for network jitter. */
export const LOCATION_MOVEMENT_LIMIT = PLAYER_WALK_SPEED * 1.2;
