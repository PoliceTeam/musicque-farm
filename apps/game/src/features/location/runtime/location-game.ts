import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import type { ChannelDirectory } from '@chibi-town/contracts';
import type { MapDefinition } from '@chibi-town/game-content';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { blocksGameInput } from '@chibi-town/ui';
import type { LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk, getRealtime } from '@/application/api-sdk';
import {
  type Attraction,
  createLocationInputState,
  locationInputAt,
  updateLocationInput,
} from '@/features/location/_utils/location-input-logic';
import { createRemotePlayers } from '@/features/location/_utils/remote-players-logic';
import {
  createEntertainmentBillboard,
  createEntertainmentGarden,
  createEntertainmentGround,
  createEntertainmentPole,
  createEntertainmentSign,
  createEntertainmentSky,
  createEntertainmentWheel,
  createEntertainmentWires,
} from '@/features/location/rendering/entertainment-ground';
import { createLocationView, type LocationLabels } from '@/features/location/rendering/location-view';
import { acquireMapAssets } from '@/game/rendering/map-assets';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

export function createLocationGame(options: {
  parent: HTMLElement;
  map: MapDefinition;
  labels(): LocationLabels;
  channel(): ChannelDirectory | undefined;
  onHeader(header: { player: LocationPlayer; coins: number; gems: number }): void;
  onChannels(): void;
  onAttraction(id: Attraction): void;
  navigate(path: string): void;
  onError(): void;
}) {
  const map = options.map;
  let disposed = false;
  let renderer: CharacterRenderer | undefined;
  let release: (() => void) | undefined;
  let leaveRoom: (() => void) | undefined;

  async function start() {
    const [providers, player, inventory] = await Promise.all([
      createPreviewProviders('phaser'),
      getApiSdk().getPlayer(),
      getApiSdk().getInventory(),
    ]);
    if (disposed) return;
    options.onHeader({ player, coins: inventory.farm.coins, gems: inventory.farm.gems });
    const generated = new Map<string, HTMLCanvasElement>();
    if (map.regionId === 'fun') {
      generated.set('entertainment:plaza', await createEntertainmentGround(map.width, 310));
      generated.set('entertainment:wires', await createEntertainmentWires(map.width));
      generated.set('entertainment:garden', createEntertainmentGarden(map.width));
      generated.set('entertainment:sky', createEntertainmentSky(map.width, 520));
    }
    const resource = await acquireMapAssets(map, generated);
    release = resource.release;
    const signSource = resource.assets.get('entertainment:zone-sign');
    let renderedChannel: number | undefined;
    let signLabel = options.labels()('channelSign');
    if (map.regionId === 'fun') {
      const pole = resource.assets.get('entertainment:utility-pole');
      if (pole) resource.assets.set('entertainment:utility-pole', createEntertainmentPole(pole));
      if (signSource)
        resource.assets.set(
          'entertainment:zone-sign',
          createEntertainmentSign(signSource, undefined, options.labels()('channelSign')),
        );
      const billboard = resource.assets.get('entertainment:billboard');
      if (billboard) resource.assets.set('entertainment:billboard', createEntertainmentBillboard(billboard));
      const disc = resource.assets.get('entertainment:wheel-disc');
      if (disc) resource.assets.set('entertainment:wheel-disc', createEntertainmentWheel(disc));
    }

    if (disposed) {
      resource.release();
      return;
    }
    release = resource.release;
    const hero = new AvatarState(toEquip(player.outfit));
    const state = createLocationInputState(map);
    const cameraTarget: [number, number] = [state.x, state.y];

    /** Maps with channels are shared: show the other players of this channel and report our own position. */
    const realtime = map.channels ? getRealtime() : undefined;
    const others = createRemotePlayers(player.id);
    let enteredChannel: number | undefined;
    const reported = { x: state.x, y: state.y, at: 0 };
    if (realtime) {
      const unsubscribe = realtime.subscribe(others.apply);
      realtime.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x: state.x, y: state.y });
      leaveRoom = () => {
        unsubscribe();
        realtime.send({ type: 'map.leave' });
      };
    }
    const draw = createLocationView(map, resource.assets, state, hero, player, others.players, options.labels);
    renderer = providers.create('phaser', {
      parent: options.parent,
      width: map.width,
      height: map.height,
      zoom: 1,
      fillParent: true,
      renderScale: 2,
      smoothSurfaces: map.regionId === 'fun',
      backgroundColor: map.regionId === 'fun' ? '#29b5f2' : '#7bb457',
      camera: {
        worldWidth: map.width,
        worldHeight: map.height,
        zoom: map.regionId === 'fun' ? 0 : 1,

        target: () => {
          cameraTarget[0] = state.x;
          cameraTarget[1] = map.regionId === 'fun' ? map.height / 2 : state.y;
          return cameraTarget;
        },
      },
      input: {
        onPointerDown(px, py) {
          if (blocksGameInput()) return;
          const hit = locationInputAt(map, px, py);
          if (hit.kind === 'channels') {
            state.target = undefined;
            options.onChannels();
          } else if (hit.kind === 'exit') {
            state.target = undefined;
            options.navigate('/');
          } else if (hit.kind === 'attraction') {
            state.target = undefined;
            if (hit.destination) options.navigate(`/play/${hit.destination.regionId}/${hit.destination.mapId}`);
            else options.onAttraction(hit.id);
          } else state.target = [px, py];
        },
      },
      fixedStep: {
        interval: 90,

        onTick: () => {
          hero.step();
          others.tick();
        },
      },

      onFrame(view, now, delta, input) {
        const channelId = options.channel()?.currentChannelId;
        if (signSource && (channelId !== renderedChannel || signLabel !== options.labels()('channelSign'))) {
          resource.assets.set(
            'entertainment:zone-sign',
            createEntertainmentSign(signSource, channelId, options.labels()('channelSign')),
          );
          renderedChannel = channelId;
          signLabel = options.labels()('channelSign');
        }
        const dt = Math.min(delta / 1000, 0.05);
        updateLocationInput(map, state, input?.direction, dt, blocksGameInput());
        if (state.dx) hero.mirror = state.dx < 0;
        hero.setAction(state.moving ? Action.Walk : Action.Stand);
        others.step(dt);
        if (realtime) {
          // The server picks the channel from the saved choice, so a channel switch means entering again.
          if (channelId !== undefined && channelId !== enteredChannel) {
            if (enteredChannel !== undefined)
              realtime.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x: state.x, y: state.y });
            enteredChannel = channelId;
            reported.x = state.x;
            reported.y = state.y;
            reported.at = now;
          } else if ((reported.x !== state.x || reported.y !== state.y) && now - reported.at >= 150) {
            realtime.send({ type: 'map.move', x: Math.round(state.x), y: Math.round(state.y) });
            reported.x = state.x;
            reported.y = state.y;
            reported.at = now;
          }
        }
        draw(view, now);
      },
    });
  }

  function destroy() {
    disposed = true;
    leaveRoom?.();
    renderer?.destroy();
    release?.();
    leaveRoom = undefined;
    renderer = undefined;
    release = undefined;
  }

  void start().catch(() => {
    if (!disposed) {
      options.onError();
      destroy();
    }
  });
  return destroy;
}
