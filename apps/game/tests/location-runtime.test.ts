import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { RealtimeNotification } from '@chibi-town/contracts/realtime';
import type { MapDefinition } from '@chibi-town/game-content';
import type { RendererOptions } from '@chibi-town/render-contracts/renderer-types';
import { beforeEach, expect, it, vi } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { createLocationGame } from '@/features/location/runtime/location-game';

const fixture = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
  release: vi.fn(),
  subscribe: vi.fn(),
  send: vi.fn(),
  unsubscribe: vi.fn(),
  draw: vi.fn(),
  view: vi.fn(),
  assets: vi.fn(),
}));
vi.mock('@/application/api-sdk', () => ({
  getApiSdk: () => ({
    getPlayer: async () => ({ id: 'me', name: 'Me', level: 1, outfit: defaultOutfit }),

    getInventory: async () => ({ farm: { coins: 1, gems: 2 } }),
  }),

  getRealtime: () => ({ send: fixture.send, subscribe: fixture.subscribe }),
}));
vi.mock('@/game/rendering/renderer-providers', () => ({
  createPreviewProviders: async () => ({ create: fixture.create }),
}));
vi.mock('@/game/rendering/map-assets', () => ({ acquireMapAssets: fixture.assets }));
vi.mock('@/features/location/rendering/location-view', () => ({ createLocationView: fixture.view }));
vi.mock('@chibi-town/ui', () => ({ blocksGameInput: () => false }));

const map: MapDefinition = {
  id: 'shared',
  label: 'Shared',
  regionId: 'school',
  scene: 'location',
  systems: [],
  spawn: [100, 100],
  width: 800,
  height: 600,
  portals: [],
  channels: { count: 2, capacity: 20 },
};

beforeEach(() => {
  vi.clearAllMocks();
  fixture.create.mockReturnValue({ destroy: fixture.destroy });
  fixture.view.mockReturnValue(fixture.draw);
  fixture.subscribe.mockReturnValue(fixture.unsubscribe);
  fixture.assets.mockResolvedValue({ assets: new Map(), release: fixture.release });
});

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

it('keeps one renderer and subscription across label changes, receives batches and resets on reconnect', async () => {
  const i18n = createGameI18n();
  let translate = i18n.getFixedT('vi', 'common');
  let outfit = defaultOutfit;
  const selectPlayer = vi.fn();
  let selectedId: string | undefined;
  const playerPosition = vi.fn();
  const cleanup = createLocationGame({
    parent: {} as HTMLElement,
    map,

    labels: () => translate,

    outfit: () => outfit,

    channel: () => undefined,

    onHeader: vi.fn(),
    onPlayer: selectPlayer,

    selectedPlayer: () => selectedId,

    onPlayerPosition: playerPosition,
    onChannels: vi.fn(),
    onAttraction: vi.fn(),
    navigate: vi.fn(),
    onError: vi.fn(),
  });
  await flush();
  const options = fixture.create.mock.calls[0][1] as RendererOptions;
  const apply = fixture.subscribe.mock.calls[0][0] as (event: RealtimeNotification) => void;
  const players = fixture.view.mock.calls[0][5] as Map<string, { target: [number, number] }>;
  apply({ type: 'map.join', player: { id: 'other', name: 'Other', level: 2, outfit: defaultOutfit, x: 0, y: 0 } });
  apply({ type: 'map.moves', moves: [{ id: 'other', x: 50, y: 60 }] });
  expect(players.get('other')?.target).toEqual([50, 60]);
  options.input?.onPointerDown?.(0, 0);
  expect(selectPlayer).toHaveBeenCalledWith('other', undefined);
  selectedId = 'other';
  options.onFrame({ clientPoint: (x: number, y: number) => [x + 100, y + 200] } as never, 100, 0);
  expect(playerPosition).toHaveBeenLastCalledWith([100, 170]);
  apply({ type: 'map.leave', id: 'other' });
  options.onFrame({} as never, 110, 0);
  expect(playerPosition).toHaveBeenLastCalledWith(undefined);
  selectedId = undefined;
  i18n.addResource('vi', 'common', 'enterLocation', 'Enter');
  translate = i18n.getFixedT('vi', 'common');
  options.onFrame({} as never, 200, 16);
  expect(fixture.view.mock.calls[0][6]()).toBe(translate);
  expect(fixture.create).toHaveBeenCalledOnce();
  expect(fixture.subscribe).toHaveBeenCalledOnce();
  expect(fixture.send.mock.calls.map((call) => call[0].type)).toEqual(['map.enter']);
  outfit = { ...defaultOutfit, hairColor: 'Đỏ' };
  options.onFrame({} as never, 216, 16);
  expect(fixture.send).toHaveBeenLastCalledWith({
    type: 'map.enter',
    regionId: 'school',
    mapId: 'shared',
    x: 100,
    y: 100,
  });
  expect(fixture.create).toHaveBeenCalledOnce();
  const publishes = fixture.send.mock.calls.length;
  options.onFrame({} as never, 232, 16);
  expect(fixture.send).toHaveBeenCalledTimes(publishes);
  apply({ type: 'reconnected' });
  expect(players.size).toBe(0);
  cleanup();
  expect(fixture.unsubscribe).toHaveBeenCalledOnce();
  expect(fixture.destroy).toHaveBeenCalledOnce();
  expect(fixture.release).toHaveBeenCalledOnce();
  expect(fixture.send).toHaveBeenLastCalledWith({ type: 'map.leave' });
});

it('releases assets resolving after unmount without entering the room or creating a renderer', async () => {
  let resolve!: (resource: { assets: Map<string, HTMLCanvasElement>; release(): void }) => void;
  fixture.assets.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const i18n = createGameI18n();
  const cleanup = createLocationGame({
    parent: {} as HTMLElement,
    map,

    labels: () => i18n.getFixedT('vi', 'common'),

    channel: () => undefined,

    onHeader: vi.fn(),
    onChannels: vi.fn(),
    onAttraction: vi.fn(),
    navigate: vi.fn(),
    onError: vi.fn(),
  });
  await flush();
  cleanup();
  resolve({ assets: new Map(), release: fixture.release });
  await flush();
  expect(fixture.release).toHaveBeenCalledOnce();
  expect(fixture.create).not.toHaveBeenCalled();
  expect(fixture.send).not.toHaveBeenCalled();
});
