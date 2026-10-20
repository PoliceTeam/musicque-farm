export type EntranceAction = 'friends' | 'home' | 'history' | 'shop' | 'exit';
export const ENTRANCE_SIZE = { width: 1280, height: 720 };
/** Rail gaps and lawns share the two approaches into the square. */
export const ENTRANCE_FENCE_Y = 447;
export const ENTRANCE_FENCE_SEGMENTS = [
  [0, 130],
  [200, 250],
  [400, 602],
  [798, 1280],
] as const;
export const ENTRANCE_LAWNS = [
  [-30, 398, 160, 146],
  [200, 398, 50, 146],
  [400, 398, 202, 146],
  [798, 398, 512, 146],
] as const;
export const ENTRANCE_TARGETS = [
  { action: 'exit', x: 602, y: 602, width: 76, height: 58, arrow: [640, 635] },
  { action: 'friends', x: 130, y: 405, width: 70, height: 100, arrow: [165, 457] },
  { action: 'home', x: 260, y: 350, width: 130, height: 150, arrow: [325, 457] },
  { action: 'shop', x: 605, y: 332, width: 190, height: 170, arrow: [700, 468] },
  { action: 'history', x: 458, y: 385, width: 108, height: 100, arrow: undefined },
] as const;
export const ENTRANCE_WALK_BOUNDS = { left: 35, right: 1240, top: 520, bottom: 640 };

export function entranceActionAt(x: number, y: number): EntranceAction | undefined {
  return ENTRANCE_TARGETS.find(
    (target) => x >= target.x && x <= target.x + target.width && y >= target.y && y <= target.y + target.height,
  )?.action;
}
