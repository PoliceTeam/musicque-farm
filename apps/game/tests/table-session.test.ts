import { createTableSession } from '@chibi-town/arcade-games-react/table-session';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.useRealTimers());

it('coalesces updates during requests/replays and consumes them once after unlock', () => {
  const session = createTableSession();
  session.activate();
  session.locked.current = true;
  session.stale.current = true;
  expect(session.consumeStale()).toBe(false);
  session.locked.current = false;
  expect(session.consumeStale()).toBe(true);
  expect(session.consumeStale()).toBe(false);
  session.stale.current = true;
  session.dispose();
  expect(session.consumeStale()).toBe(false);
});

it('preserves replay delays and resolves pending waits when disposed', async () => {
  vi.useFakeTimers();
  const session = createTableSession();
  session.activate();
  const done = vi.fn();
  void session.pause(650).then(done);
  await vi.advanceTimersByTimeAsync(649);
  expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toHaveBeenCalledOnce();
  const cancelled = vi.fn();
  void session.pause(2200).then(cancelled);
  session.dispose();
  await Promise.resolve();
  expect(cancelled).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  await session.pause(650);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps locks and timers separate for independent table mounts', async () => {
  vi.useFakeTimers();
  const first = createTableSession(),
    second = createTableSession();
  first.activate();
  second.activate();
  first.locked.current = true;
  expect(second.locked.current).toBe(false);
  const next = vi.fn();
  void second.pause(300).then(next);
  first.dispose();
  expect(second.alive.current).toBe(true);
  await vi.advanceTimersByTimeAsync(300);
  expect(next).toHaveBeenCalledOnce();
  second.dispose();
});
