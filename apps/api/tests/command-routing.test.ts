import type { Command } from '@chibi-town/contracts';
import { isInventoryCommand } from '@chibi-town/game-service';
import { expect, it, vi } from 'vitest';
import { createCommandController } from '@/modules/commands/controller';

// Exhaustive over the contract union: adding a command requires an explicit routing expectation.
const routes = {
  'buy-cosmetic': true,
  'move-character-item': true,
  'equip-character-item': true,
  'unequip-character-item': true,
  'apply-cosmetic-color': true,
  'equip-outfit': true,
  plot: false,
  batch: false,
  expand: false,
  feed: false,
  collect: false,
  'buy-animal': false,
  'buy-seeds': false,
  cook: false,
  'collect-dish': false,
  'sell-animal': false,
  'butcher-animal': false,
  sell: false,
  'upgrade-chest': false,
  'transfer-goods': false,
  'feed-all': false,
  'collect-all': false,
} satisfies Record<Command['type'], boolean>;

it.each(Object.entries(routes))('routes %s through the shared inventory predicate', (type, inventory) => {
  expect(isInventoryCommand({ type } as Command)).toBe(inventory);
});

it('uses the shared predicate at the API boundary', () => {
  const farm = { execute: vi.fn() },
    inventory = { execute: vi.fn() };
  const controller = createCommandController({ farm, inventory } as unknown as Parameters<
    typeof createCommandController
  >[0]);
  const request = {
    body: { type: 'feed-all', requestId: 'route', mapInstanceId: 'home' },
    player: { id: 'p' },
    log: {
      debug: vi.fn(),

      child() {
        return this;
      },
    },
  };
  controller.execute(request as unknown as Parameters<typeof controller.execute>[0]);
  expect(farm.execute).toHaveBeenCalledOnce();
  expect(inventory.execute).not.toHaveBeenCalled();
});
