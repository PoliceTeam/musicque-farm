type Revision = { id: string; revision: number };

/** Initial/reloaded screens establish a baseline; only subsequent, newer actions are animated. */
export function unseenTableSteps<Step>(
  previous: Revision | undefined,
  next: (Revision & { lastSteps?: { revision: number; steps: Step[] } }) | undefined,
): Step[] {
  if (
    !previous ||
    !next ||
    previous.id !== next.id ||
    !next.lastSteps ||
    next.lastSteps.revision <= previous.revision ||
    next.lastSteps.revision > next.revision
  )
    return [];
  return next.lastSteps.steps;
}

export function turnSeconds(turnEndsAt: number, serverTime: number, receivedAt: number, now: number): number {
  return Math.max(0, Math.ceil((turnEndsAt - serverTime - (now - receivedAt)) / 1000));
}

export type ArcadeResultSnapshot = {
  id: string;
  status: string;
  winner?: number;
  outcome?: 'win' | 'loss' | 'draw';
  session?: { mode: string; settled?: boolean; coinDelta?: number };
};

export function arcadeResultOutcome(match: ArcadeResultSnapshot): 'win' | 'loss' | 'draw' | undefined {
  if (!['finished', 'won', 'lost'].includes(match.status)) return;
  if (match.session?.mode === 'wager') {
    if (!match.session.settled) return;
    const delta = match.session.coinDelta;
    if (delta !== undefined && delta !== 0) return delta > 0 ? 'win' : 'loss';
  }
  return (
    match.outcome ??
    (match.status === 'won' || match.winner === 0
      ? 'win'
      : match.status === 'lost' || match.winner !== undefined
        ? 'loss'
        : undefined)
  );
}

/** Celebrate a newly completed round, never a restored result or a duplicate snapshot. */
export function newArcadeResult(previous: ArcadeResultSnapshot | undefined, next: ArcadeResultSnapshot | undefined) {
  if (!previous || !next || previous.id !== next.id || arcadeResultOutcome(previous)) return;
  return arcadeResultOutcome(next);
}
