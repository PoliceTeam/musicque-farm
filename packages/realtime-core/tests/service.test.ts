import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryAdapters } from '../src/memory.js';
import type { Connection } from '../src/ports.js';
import { createRealtimeService } from '../src/realtime-service.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

function service() {
  const adapters = createMemoryAdapters();
  let attach!: (connection: Connection) => void;
  const validateSession = vi.fn<() => Promise<number | undefined>>(async () => Number.MAX_SAFE_INTEGER);
  const realtime = createRealtimeService({
    ...adapters,
    clock: Date.now,
    transport: {
      accept(listener) {
        attach = listener;
        return () => {};
      },
    },

    decode: (raw) => JSON.parse(raw),

    validateSession,

    onError(error) {
      throw error;
    },
  });
  cleanup.push(realtime.close);

  function connect(id: string) {
    const received: string[] = [];

    let close = () => {};

    let message = (_raw: string) => {};

    let closed = false;
    const connection: Connection = {
      id,
      identity: { playerId: id, sessionId: id, expiresAt: Number.MAX_SAFE_INTEGER, context: null },
      bufferedAmount: 0,

      send(raw) {
        received.push(raw);
      },

      close() {
        if (!closed) {
          closed = true;
          close();
        }
      },

      terminate() {
        connection.close(1006);
      },

      ping() {},

      onPong() {},

      onMessage(listener) {
        message = listener;
      },

      onClose(listener) {
        close = listener;
      },
    };
    attach(connection);
    return {
      connection,
      received,

      message: (raw: string) => message(raw),
    };
  }

  return { adapters, realtime, connect, validateSession };
}

it('shares one bus subscription per locally watched topic and serializes an event once', async () => {
  const { adapters, realtime, connect } = service();
  const subscribe = vi.spyOn(adapters.bus, 'subscribe');
  const one = connect('one'),
    two = connect('two');
  await realtime.subscribe(one.connection, 'room');
  await realtime.subscribe(two.connection, 'room');
  expect(subscribe.mock.calls.filter(([topic]) => topic === 'room')).toHaveLength(1);
  expect(subscribe.mock.calls.some(([topic]) => topic === 'unwatched')).toBe(false);
  let serializations = 0;
  await realtime.publish('room', {
    type: 'changed',

    get value() {
      serializations++;
      return 1;
    },
  });
  expect(serializations).toBe(1);
  expect(one.received).toEqual(['{"type":"changed","value":1}']);
  expect(two.received).toEqual(one.received);
  await realtime.publish('room', { type: 'except' }, one.connection.id);
  expect(one.received).toHaveLength(1);
  expect(two.received).toHaveLength(2);
  await realtime.unsubscribe(one.connection, 'room');
  await realtime.unsubscribe(two.connection, 'room');
  await realtime.publish('room', { type: 'after-leave' });
  expect(two.received).toHaveLength(2);
});

it('keeps handler order per connection and allows another connection past slow work', async () => {
  const { realtime, connect } = service();
  const seen: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  realtime.handle<{ type: 'work'; value: string }>('work', async (connection, command) => {
    if (command.value === 'slow') await blocked;
    seen.push(`${connection.id}:${command.value}`);
  });
  const one = connect('one'),
    two = connect('two');
  one.message('{"type":"work","value":"slow"}');
  one.message('{"type":"work","value":"after"}');
  two.message('{"type":"work","value":"independent"}');
  try {
    await vi.waitFor(() => expect(seen).toEqual(['two:independent']));
  } finally {
    release();
  }
  await vi.waitFor(() => expect(seen).toEqual(['two:independent', 'one:slow', 'one:after']));
});

it('removes heartbeat and delayed-disconnect timers when the service shuts down', async () => {
  vi.useFakeTimers();
  try {
    const { realtime, connect } = service();
    connect('one');
    await realtime.close();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('checks revocation after asynchronous subscriptions are ready so handshake cannot miss a logout', async () => {
  const { realtime, connect, validateSession } = service();
  validateSession.mockResolvedValue(undefined);
  const { connection } = connect('revoked-between-handshake-and-subscribe');
  const close = vi.spyOn(connection, 'close');
  await vi.waitFor(() => expect(close).toHaveBeenCalledWith(4001));
  await realtime.close();
});

it('waits for asynchronous transport close and lease cleanup before closing adapters', async () => {
  const { adapters, realtime, connect } = service();
  const { connection } = connect('async-close');
  await vi.waitFor(async () => expect(await adapters.store.connected('async-close', Date.now())).toBe(true));
  const close = connection.close;
  vi.spyOn(connection, 'close').mockImplementationOnce((code) => {
    setTimeout(() => close(code), 10);
  });
  const release = vi.spyOn(adapters.store, 'release');
  await realtime.close();
  expect(release).toHaveBeenCalledWith('async-close', 'async-close');
});
