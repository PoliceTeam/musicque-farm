import { type GemStep, gemMatchGroups } from '@chibi-town/arcade-games/gem-battle-logic';

export const GEM_REPLAY_TIMING = { swap: 260, prepare: 220, bot: 520, clear: 420, fall: 560, settle: 300, reward: 450 };
export type GemReplay = { id: number; phase: 'prepare' | 'clear' | 'fall'; step: GemStep };

/** Rows travelled by each destination, including new gems entering above the board. */
export function gemFallRows(cleared: readonly number[]): number[] {
  const removed = new Set(cleared),
    rows = Array<number>(64).fill(0);
  for (let col = 0; col < 8; col++) {
    const retained = Array.from({ length: 8 }, (_, row) => row).filter((row) => !removed.has(row * 8 + col));
    const missing = 8 - retained.length;
    for (let row = 0; row < 8; row++) rows[row * 8 + col] = row < missing ? missing : row - retained[row - missing];
  }
  return rows;
}

export function largestGemMatch(step: GemStep) {
  return step.beforeBoard ? Math.max(0, ...gemMatchGroups(step.beforeBoard).map((group) => group.length)) : 0;
}
