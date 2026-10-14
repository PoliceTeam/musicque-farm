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
