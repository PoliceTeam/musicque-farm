import type { GameSdk } from '@chibi-town/contracts';
import { expect, it, vi } from 'vitest';
import { navigateLocationPortal } from '@/features/location/location-navigation-handler';

const portal = { id: 'portal-id', target: 'target', spawn: [10, 20] as const };

it('catches portal getWorld failures and ignores errors after unmount', async () => {
  let active = true;
  const options = {
    getWorld: vi.fn<GameSdk['getWorld']>().mockRejectedValue(new Error('offline')),

    isActive: () => active,

    navigate: vi.fn(),
    onError: vi.fn(),
  };
  await navigateLocationPortal(portal, options);
  expect(options.onError).toHaveBeenCalledOnce();
  active = false;
  await navigateLocationPortal(portal, options);
  expect(options.onError).toHaveBeenCalledOnce();
  expect(options.navigate).not.toHaveBeenCalled();
});

it('ignores a late portal response after unmount and preserves destination spawn on success', async () => {
  let active = true;
  let resolve!: (world: Awaited<ReturnType<GameSdk['getWorld']>>) => void;
  const world = { revision: 0, regions: [], maps: [{ id: 'target', regionId: 'fun' }] } as unknown as Awaited<
    ReturnType<GameSdk['getWorld']>
  >;
  const options = {
    getWorld: () =>
      new Promise<Awaited<ReturnType<GameSdk['getWorld']>>>((r) => {
        resolve = r;
      }),

    isActive: () => active,

    navigate: vi.fn(),
    onError: vi.fn(),
  };
  const opening = navigateLocationPortal(portal, options);
  active = false;
  resolve(world);
  await opening;
  expect(options.navigate).not.toHaveBeenCalled();
  active = true;
  const success = navigateLocationPortal(portal, options);
  resolve(world);
  await success;
  expect(options.navigate).toHaveBeenCalledWith('/play/fun/target?spawn=10,20');
});
