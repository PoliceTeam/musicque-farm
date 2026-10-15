import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Adapters } from '../ports.js';

/** Each factory returns two independent clients against one isolated backend. */
export function adapterContract(name: string, factory: () => Promise<[Adapters, Adapters]>) {
  describe(name, () => {
    const cleanup: Adapters[] = [];
    afterEach(async () => {
      for (const adapter of cleanup.splice(0)) await adapter.close();
    });

    async function pair() {
      const adapters = await factory();
      cleanup.push(...new Set(adapters));
      return adapters;
    }

    it('atomically claims the last place, counts distinct players and expires reservations', async () => {
      const [a, b] = await pair();

      const claim = (adapter: Adapters, id: string) =>
        adapter.store.claim('room', id, { owner: id, player: null }, 1, 1000, 2000);

      expect((await Promise.all([claim(a, 'a'), claim(b, 'b')])).filter(Boolean)).toHaveLength(1);
      expect(await b.store.count('room', '', 1000)).toBe(1);
      expect(await b.store.count('room', '', 2000)).toBe(0);
      expect(await claim(b, 'c')).toBe(true);
      expect(await claim(a, 'c')).toBe(true);
      expect(await a.store.count('room', 'c', 1000)).toBe(0);
    });

    it('expires mixed HTTP reservations and socket leases at their own deadlines in one room', async () => {
      const [a, b] = await pair();
      await a.store.claim('room', 'socket', { owner: 'connection', player: { x: 1 } }, 2, 0, 1000);
      await b.store.claim('room', 'http', { owner: 'http:http', player: null }, 2, 0, 10_000);
      expect(await a.store.count('room', '', 1500)).toBe(1);
      expect(await a.store.members('room', 1500)).toEqual({ http: { owner: 'http:http', player: null } });
      expect(await b.store.count('room', '', 10_000)).toBe(0);
    });

    it('checks owners for updates, removals and heartbeat; moves do not renew leases', async () => {
      const [a, b] = await pair();
      await a.store.claim('room', 'p', { owner: 'old', player: { x: 1 } }, 2, 0, 1000);
      await b.store.claim('room', 'p', { owner: 'new', player: { x: 2 } }, 2, 0, 1000);
      expect(await a.store.update('room', 'p', { owner: 'old', player: {} }, 0)).toBe(false);
      expect(await a.store.remove('room', 'p', 'old')).toBe(false);
      expect(await a.store.touch('room', 'p', 'old', 0, 5000)).toBe(false);
      expect(await b.store.update('room', 'p', { owner: 'new', player: { x: 3 } }, 900)).toBe(true);
      expect(await a.store.members('room', 900)).toEqual({ p: { owner: 'new', player: { x: 3 } } });
      expect(await a.store.members('room', 1000)).toEqual({});
      expect(await b.store.update('room', 'p', { owner: 'new', player: {} }, 1000)).toBe(false);
      expect(await b.store.touch('room', 'p', 'new', 1000, 5000)).toBe(false);
    });

    it('keeps a socket owner and drawing data when HTTP reserves its existing room', async () => {
      const [a, b] = await pair();
      await a.store.claim('room', 'p', { owner: 'socket', player: { x: 1 } }, 1, 0, 1000);
      expect(await b.store.claim('room', 'p', { owner: 'http:p', player: null }, 1, 500, 9000)).toBe(true);
      expect(await a.store.members('room', 500)).toEqual({ p: { owner: 'socket', player: { x: 1 } } });
      expect(await a.store.members('room', 1000)).toEqual({});
    });

    it('atomically takes all room changes once per shared tick across two instances', async () => {
      const [a, b] = await pair();
      await a.store.claim('room', 'a', { owner: 'a', player: { x: 0 } }, 2, 0, 10_000);
      await b.store.claim('room', 'b', { owner: 'b', player: { x: 0 } }, 2, 0, 10_000);
      await a.store.update('room', 'a', { owner: 'a', player: { x: 1 } }, 100);
      await b.store.update('room', 'b', { owner: 'b', player: { x: 2 } }, 100);
      const batches = await Promise.all([a.store.takeChanges('room', 100, 100), b.store.takeChanges('room', 100, 100)]);
      expect(batches.filter((batch) => batch && Object.keys(batch).length)).toEqual([
        {
          a: { owner: 'a', player: { x: 1 } },
          b: { owner: 'b', player: { x: 2 } },
        },
      ]);
      await b.store.update('room', 'b', { owner: 'b', player: { x: 3 } }, 150);
      expect(await a.store.takeChanges('room', 150, 100)).toBeUndefined();
      await a.store.update('room', 'b', { owner: 'b', player: { x: 4 } }, 175);
      expect(await b.store.takeChanges('room', 200, 100)).toEqual({ b: { owner: 'b', player: { x: 4 } } });
      await a.store.update('room', 'a', { owner: 'a', player: { x: 5 } }, 210);
      await b.store.claim('room', 'a', { owner: 'new', player: { x: 6 } }, 2, 220, 10_000);
      expect(await a.store.takeChanges('room', 300, 100)).toEqual({});
    });

    it('renews a single connection deadline and protects reconnected tabs', async () => {
      const [a, b] = await pair();
      await a.store.lease('p', 'old', 1000);
      await b.store.lease('p', 'new', 2000);
      await a.store.release('p', 'old');
      expect(await a.store.connected('p', 1500)).toBe(true);
      expect(await b.store.connected('p', 2000)).toBe(false);
    });

    it('delivers once in order to subscribed topics, stops after unsubscribe', async () => {
      const [a, b] = await pair();
      const received: string[] = [];
      const stop = await b.bus.subscribe('watched', (raw) => received.push(raw));
      await a.bus.publish('other', 'hidden');
      await a.bus.publish('watched', 'one');
      await a.bus.publish('watched', 'two');
      await vi.waitFor(() => expect(received).toEqual(['one', 'two']));
      await stop();
      await a.bus.publish('watched', 'three');
      const again = await b.bus.subscribe('watched', (raw) => received.push(raw));
      await a.bus.publish('watched', 'four');
      await vi.waitFor(() => expect(received).toEqual(['one', 'two', 'four']));
      await again();
    });

    it('shares KV and serializes attempts per key without blocking unrelated keys', async () => {
      const [a, b] = await pair();
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? a : b).coordination.exclusive('attempt', async () => {
            const count = (await a.coordination.get<number>('count')) ?? 0;
            await a.coordination.set('count', count + 1, 10_000);
          }),
        ),
      );
      expect(await b.coordination.get('count')).toBe(10);
      await a.coordination.delete('count');
      expect(await b.coordination.get('count')).toBeUndefined();
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = a.coordination.exclusive('a', () => blocked);
      try {
        await b.coordination.exclusive('b', async () => {});
      } finally {
        release();
        await held;
      }
    });
  });
}
