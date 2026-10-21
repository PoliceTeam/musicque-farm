import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { toEquip, wornPet } from '@chibi-town/character-core/outfit-logic';
import type { ChannelDirectory } from '@chibi-town/contracts';
import type { MapDefinition, MapLayer } from '@chibi-town/game-content';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { blocksGameInput } from '@chibi-town/ui';
import type { LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk, getRealtime } from '@/application/api-sdk';
import { type ChatBubbles, expireBubbles, queueBubble } from '@/features/chat/_utils/chat-bubbles';
import {
  type Attraction,
  createLocationInputState,
  locationInputAt,
  updateLocationInput,
} from '@/features/location/_utils/location-input-logic';
import { createRemotePlayers } from '@/features/location/_utils/remote-players-logic';
import { navigateLocationPortal } from '@/features/location/location-navigation-handler';
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
import { makePet, stepPet } from '@/game/movement/pet-follow-logic';
import { acquireMapAssets } from '@/game/rendering/map-assets';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';
import { LOCATION_WALK_SPEED } from '@/game/runtime/game-config';

export function createLocationGame(options: {
  parent: HTMLElement;
  map: MapDefinition;
  labels(): LocationLabels;
  outfit?(): Outfit | undefined;
  channel(): ChannelDirectory | undefined;
  onHeader(header: { player: LocationPlayer; coins: number; gems: number }): void;
  onChannels(): void;
  onPlayer?(id: string, point?: [number, number]): void;
  selectedPlayer?(): string | undefined;
  onPlayerPosition?(point?: [number, number]): void;
  onAttraction(id: Attraction): void;
  onShop?(shop: NonNullable<MapLayer['shop']>): void;
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
    if (map.presentation === 'street') {
      generated.set('entertainment:plaza', await createEntertainmentGround(map.width, 310));
      if (map.layers?.some((layer) => layer.asset === 'entertainment:wires'))
        generated.set('entertainment:wires', await createEntertainmentWires(map.width));
      generated.set('entertainment:garden', createEntertainmentGarden(map.width));
      generated.set('entertainment:sky', createEntertainmentSky(map.width, 520));
    }
    const resource = await acquireMapAssets(map, generated);
    release = resource.release;
    const signKey = map.layers?.find((layer) => layer.id === 'zone-sign')?.asset ?? 'entertainment:zone-sign';
    const signSource = resource.assets.get(signKey);
    let renderedChannel: number | undefined;
    let signLabel = options.labels()('channelSign');
    if (map.presentation === 'street') {
      const pole = resource.assets.get('entertainment:utility-pole');
      if (pole) resource.assets.set('entertainment:utility-pole', createEntertainmentPole(pole));
      if (signSource)
        resource.assets.set(signKey, createEntertainmentSign(signSource, undefined, options.labels()('channelSign')));
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
    let equipped = player.outfit;
    const state = createLocationInputState(map);
    const initialPet = wornPet(player.outfit);
    state.pet = initialPet ? makePet(initialPet, state.x, state.y, hero.mirror) : undefined;
    const cameraTarget: [number, number] = [state.x, state.y];

    /** Maps with channels are shared: show the other players of this channel and report our own position. */
    const realtime = map.channels ? getRealtime() : undefined;
    const others = createRemotePlayers(player.id);
    const bubbles: ChatBubbles = new Map();
    let bubbleChannel: number | undefined;
    let enteredChannel: number | undefined;
    const reported = { x: state.x, y: state.y, at: 0 };
    if (realtime) {
      const unsubscribe = realtime.subscribe((event) => {
        others.apply(event);
        if (event.type === 'disconnected' || event.type === 'reconnected') {
          bubbles.clear();
          bubbleChannel = undefined;
        }
        if (event.type === 'map.state' && event.mapId === map.id) {
          if (bubbleChannel !== event.channelId) bubbles.clear();
          bubbleChannel = event.channelId;
        }
        if (
          event.type === 'chat.message' &&
          event.scope.regionId === map.regionId &&
          event.scope.mapId === map.id &&
          event.scope.channelId === bubbleChannel
        )
          queueBubble(bubbles, event.message, Date.now());
      });
      realtime.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x: state.x, y: state.y });
      leaveRoom = () => {
        unsubscribe();
        realtime.send({ type: 'map.leave' });
      };
    }
    const draw = createLocationView(map, resource.assets, state, hero, player, others.players, options.labels, bubbles);
    renderer = providers.create('phaser', {
      parent: options.parent,
      width: map.width,
      height: map.height,
      zoom: 1,
      fillParent: true,
      renderScale: 2,
      smoothSurfaces: !!map.presentation,
      backgroundColor: map.presentation === 'interior' ? '#292832' : '#29b5f2',
      camera: {
        worldWidth: map.width,
        worldHeight: map.height,
        zoom: map.presentation ? 0 : 1,

        target: () => {
          cameraTarget[0] = state.x;
          // Interior exits sit near the bottom: follow the player so wide viewports cannot crop them out.
          cameraTarget[1] = map.presentation === 'street' ? map.height / 2 : state.y;
          return cameraTarget;
        },
      },
      input: {
        onPointerDown(px, py) {
          if (blocksGameInput()) return;
          const selected = [...others.players.values()]
            .sort((a, b) => b.y - a.y)
            .find((other) => Math.abs(other.x - px) <= 24 && py >= other.y - 78 && py <= other.y + 8);
          if (selected && options.onPlayer) {
            state.target = undefined;
            options.onPlayer(selected.id, renderer?.clientPoint?.(selected.x, selected.y - 30));
            return;
          }
          const hit = locationInputAt(map, px, py);
          if (hit.kind === 'channels') {
            state.target = undefined;
            options.onChannels();
          } else if (hit.kind === 'exit') {
            state.target = undefined;
            options.navigate('/');
          } else if (hit.kind === 'shop') {
            state.target = undefined;
            options.onShop?.(hit.shop);
          } else if (hit.kind === 'destination') {
            state.target = undefined;
            options.navigate(`/play/${hit.destination.regionId}/${hit.destination.mapId}`);
          } else if (hit.kind === 'portal') {
            state.target = undefined;
            void navigateLocationPortal(hit.portal, {
              getWorld: () => getApiSdk().getWorld(),

              isActive: () => !disposed,

              navigate: options.navigate,
              onError: options.onError,
            });
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
        const selectedId = options.selectedPlayer?.();
        if (selectedId) {
          const selected = others.players.get(selectedId);
          options.onPlayerPosition?.(selected ? view.clientPoint?.(selected.x, selected.y - 30) : undefined);
        }
        const nextOutfit = options.outfit?.();
        if (nextOutfit && nextOutfit !== equipped) {
          equipped = nextOutfit;
          hero.equip = toEquip(nextOutfit);
          player.outfit = nextOutfit;
          const nextPet = wornPet(nextOutfit);
          if (nextPet?.id !== state.pet?.def.id)
            state.pet = nextPet ? makePet(nextPet, state.x, state.y, hero.mirror) : undefined;
          realtime?.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x: state.x, y: state.y });
        }
        const channelId = options.channel()?.currentChannelId;
        if (signSource && (channelId !== renderedChannel || signLabel !== options.labels()('channelSign'))) {
          resource.assets.set(signKey, createEntertainmentSign(signSource, channelId, options.labels()('channelSign')));
          renderedChannel = channelId;
          signLabel = options.labels()('channelSign');
        }
        const dt = Math.min(delta / 1000, 0.05);
        updateLocationInput(map, state, input?.direction, dt, blocksGameInput());
        if (state.dx) hero.mirror = state.dx < 0;
        hero.setAction(state.moving ? Action.Walk : Action.Stand);
        if (state.pet)
          stepPet(state.pet, { x: state.x, y: state.y, speed: LOCATION_WALK_SPEED, mirror: hero.mirror }, dt);
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
        expireBubbles(bubbles, Date.now());
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
