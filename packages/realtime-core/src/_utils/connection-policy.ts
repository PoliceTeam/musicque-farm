/** Pure connection policy; the service owns clocks, timers and queues; transport adapters own socket operations. */
export const CONNECTION_POLICY = {
  messagesPerSecond: 30,
  burst: 40,
  expensivePerSecond: 2,
  expensiveBurst: 2,
  moveIntervalMs: 80,
  queueLimit: 16,
  bufferedLimit: 256 * 1024,
  heartbeatMs: 15_000,
  sessionCheckEveryHeartbeats: 4,
  leaseMs: 45_000,
} as const;
export const CONNECTION_CLOSE = { session: 4001, queue: 4008, slow: 4009 } as const;
export type RateBudget = { at: number; tokens: number };

export function consumeRate(
  previous: RateBudget | undefined,
  now: number,
  perSecond: number,
  burst: number,
): { allowed: boolean; budget: RateBudget } {
  const at = Math.max(previous?.at ?? now, now);
  const tokens = Math.min(burst, (previous?.tokens ?? burst) + ((at - (previous?.at ?? at)) * perSecond) / 1000);
  const allowed = tokens >= 1;
  return { allowed, budget: { at, tokens: allowed ? tokens - 1 : tokens } };
}

export function queueCloseCode(pending: number): number | undefined {
  return pending >= CONNECTION_POLICY.queueLimit ? CONNECTION_CLOSE.queue : undefined;
}

export function backpressureCloseCode(buffered: number): number | undefined {
  return buffered > CONNECTION_POLICY.bufferedLimit ? CONNECTION_CLOSE.slow : undefined;
}

export function heartbeatAction(pong: boolean, sessionValid: boolean, buffered: number) {
  if (!sessionValid) return 'session';
  if (backpressureCloseCode(buffered)) return 'slow';
  return pong ? 'refresh' : 'terminate';
}

export function sessionCheckDue(checkedAt: number, now: number): boolean {
  return now - checkedAt >= CONNECTION_POLICY.heartbeatMs * CONNECTION_POLICY.sessionCheckEveryHeartbeats;
}

export type ConnectionWork<T> = { kind: 'command' | 'move' | 'maintenance'; value: T };

/** Keep one pending move at the tail so its replacement cannot jump ahead of enter/leave. */
export function queueConnectionWork<T>(
  waiting: readonly ConnectionWork<T>[],
  next: ConnectionWork<T>,
  runningCommand: boolean,
): { waiting: ConnectionWork<T>[]; closeCode?: number } {
  if (next.kind === 'command') {
    const pending = waiting.filter((work) => work.kind === 'command').length + Number(runningCommand);
    const closeCode = queueCloseCode(pending);
    if (closeCode) return { waiting: [...waiting], closeCode };
  }
  const remaining = next.kind === 'move' ? waiting.filter((work) => work.kind !== 'move') : waiting;
  return { waiting: [...remaining, next] };
}
