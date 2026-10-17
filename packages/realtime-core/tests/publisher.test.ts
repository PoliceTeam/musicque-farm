import { expect, it } from 'vitest';
import { createMemoryAdapters } from '../src/memory.js';
import { createRealtimePublisher } from '../src/publisher.js';

it('lets a worker publish compatible envelopes without constructing sockets or presence', async () => {
  const adapters = createMemoryAdapters();
  const topic: string[] = [],
    player: string[] = [];
  const stop = await adapters.bus.subscribe('jobs', (raw) => topic.push(raw));
  const stopPlayer = await adapters.bus.subscribe('player:p1', (raw) => player.push(raw));
  try {
    const publisher = createRealtimePublisher(adapters.bus);
    await publisher.publish('jobs', { type: 'changed' }, 'except');
    await publisher.notifyPlayers(['p1', 'p1'], { type: 'wallet' });
    expect(topic.map((raw) => JSON.parse(raw))).toEqual([{ data: '{"type":"changed"}', except: 'except' }]);
    expect(player.map((raw) => JSON.parse(raw))).toEqual([{ data: '{"type":"wallet"}' }]);
  } finally {
    await stop();
    await stopPlayer();
    await adapters.close();
  }
});
