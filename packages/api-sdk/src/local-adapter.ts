import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';
import { createGameService } from '@chibi-town/game-service';

import type { LocalDocument, LocalRepository } from './local-repository.js';

type Operation = (...args: never[]) => (document: LocalDocument) => unknown;

/** Runs the shared game service against one local save: a fixed player, no other players. */
export function createLocalSdk(options: {
  repository: LocalRepository;
  clock?: () => number;
  random?: () => number;
  latencyMs?: number;
  fail?: () => boolean;
  channelPopulation?: (mapId: string, channelId: number, capacity: number) => number;
  world?: Awaited<ReturnType<GameSdk['getWorld']>>;
}): GameSdk {
  const service = createGameService({
    player: { id: 'local-player', name: 'Bé Chibi', level: 1 },
    clock: options.clock ?? Date.now,
    random: options.random,
    /** Stable made-up occupancy, so empty, busy and full channels can be tried without a server. */
    channelPopulation:
      options.channelPopulation ?? ((_mapId, id, capacity) => (id === 0 ? 0 : (id * 7 + 3) % (capacity + 1))),
    world: options.world,
  });

  const gate = async () => {
    if (options.latencyMs) await new Promise((resolve) => setTimeout(resolve, options.latencyMs));
    if (options.fail?.()) throw new ApiSdkError('NETWORK_ERROR');
  };

  return Object.fromEntries(
    Object.entries(service as Record<string, Operation>).map(([name, prepare]) => [
      name,
      async (...args: never[]) => {
        const operation = prepare(...args);
        await gate();
        return options.repository.transaction(operation);
      },
    ]),
  ) as unknown as GameSdk;
}
