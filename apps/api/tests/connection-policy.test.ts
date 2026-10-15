import {
  backpressureCloseCode,
  CONNECTION_POLICY,
  type ConnectionWork,
  consumeRate,
  heartbeatAction,
  queueCloseCode,
  queueConnectionWork,
  sessionCheckDue,
} from '@chibi-town/realtime-core/connection-policy';
import { expect, it } from 'vitest';
import { acceptMovement, startMovement } from '@/modules/world/movement-policy';

it('refills rate budgets by time without mutating state or giving credit for clock rollback', () => {
  const first = consumeRate(undefined, 1000, 2, 2);
  const second = consumeRate(first.budget, 1000, 2, 2);
  expect(consumeRate(second.budget, 1000, 2, 2).allowed).toBe(false);
  expect(consumeRate(second.budget, 500, 2, 2).allowed).toBe(false);
  expect(consumeRate(second.budget, 1500, 2, 2).allowed).toBe(true);
  expect(first.budget.tokens).toBe(1);
  expect(second.budget.tokens).toBe(0);
});

it('defines queue, backpressure and heartbeat boundaries without transport dependencies', () => {
  expect(queueCloseCode(CONNECTION_POLICY.queueLimit - 1)).toBeUndefined();
  expect(queueCloseCode(CONNECTION_POLICY.queueLimit)).toBe(4008);
  expect(backpressureCloseCode(CONNECTION_POLICY.bufferedLimit)).toBeUndefined();
  expect(backpressureCloseCode(CONNECTION_POLICY.bufferedLimit + 1)).toBe(4009);
  expect(heartbeatAction(true, true, 0)).toBe('refresh');
  expect(heartbeatAction(false, true, 0)).toBe('terminate');
  expect(heartbeatAction(true, false, 0)).toBe('session');
  expect(heartbeatAction(true, true, CONNECTION_POLICY.bufferedLimit + 1)).toBe('slow');
});

it('bounds cumulative distance, accepts normal walking and does not bank unlimited idle time', () => {
  let state = startMovement(0, 0, 1000);
  expect(acceptMovement(state, 100, 100, 1000)).toBeUndefined();
  state = acceptMovement(state, 40, 0, 1000)!;
  expect(acceptMovement(state, 41, 0, 1000)).toBeUndefined();
  for (let i = 1; i <= 20; i++) state = acceptMovement(state, 40 + i * 10, 0, 1000 + i * 100)!;
  expect(state.x).toBe(240);
  expect(acceptMovement(state, 900, 0, 1_000_000)).toBeUndefined();
  expect(acceptMovement(state, -1, 0, 1_000_000)).toBeUndefined();
  expect(acceptMovement(state, Number.NaN, 0, 1_000_000)).toBeUndefined();
});

it('checks revocation every four heartbeats', () => {
  const interval = CONNECTION_POLICY.heartbeatMs * CONNECTION_POLICY.sessionCheckEveryHeartbeats;
  expect(sessionCheckDue(1000, 1000 + interval - 1)).toBe(false);
  expect(sessionCheckDue(1000, 1000 + interval)).toBe(true);
  expect(sessionCheckDue(1000, 500)).toBe(false);
});

it('keeps at most one pending move, placing its replacement after enter and leave barriers', () => {
  const original: ConnectionWork<string>[] = [
    { kind: 'command', value: 'enter-a' },
    { kind: 'move', value: 'move-a' },
    { kind: 'command', value: 'leave-a' },
    { kind: 'command', value: 'enter-b' },
  ];
  let waiting = original;
  for (let i = 0; i < 1000; i++)
    waiting = queueConnectionWork(waiting, { kind: 'move', value: `move-${i}` }, false).waiting;
  expect(waiting.map((work) => work.value)).toEqual(['enter-a', 'leave-a', 'enter-b', 'move-999']);
  expect(original.map((work) => work.value)).toEqual(['enter-a', 'move-a', 'leave-a', 'enter-b']);
});

it('counts running and waiting commands toward the cap, excluding moves and maintenance', () => {
  const waiting: ConnectionWork<number>[] = Array.from({ length: CONNECTION_POLICY.queueLimit - 1 }, (_, value) => ({
    kind: 'command',
    value,
  }));
  waiting.push({ kind: 'move', value: 100 }, { kind: 'maintenance', value: 101 });
  expect(queueConnectionWork(waiting, { kind: 'command', value: 102 }, true).closeCode).toBe(4008);
  expect(queueConnectionWork(waiting, { kind: 'command', value: 102 }, false).closeCode).toBeUndefined();
  expect(queueConnectionWork(waiting, { kind: 'move', value: 103 }, true).closeCode).toBeUndefined();
});
