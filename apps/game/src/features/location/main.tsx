import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import type { ChannelDirectory } from '@chibi-town/contracts';
import type { createGameAudio } from '@chibi-town/game-audio';
import type { MapDefinition } from '@chibi-town/game-content';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { blocksGameInput } from '@chibi-town/ui';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationLayout, type LocationPlayer } from '@/application/_components/location-layout';
import { getApiSdk, getRealtime } from '@/application/api-sdk';
import { sheet } from '@/assets/asset-catalog';
import { locationCss } from '@/assets/generated-styles';
import { ChannelDialog } from '@/features/location/_components/channel-dialog';
import { moveInLocation } from '@/features/location/_utils/location-logic';
import { createRemotePlayers } from '@/features/location/_utils/remote-players-logic';
import {
  createEntertainmentBillboard,
  createEntertainmentGarden,
  createEntertainmentGround,
  createEntertainmentPole,
  createEntertainmentShadow,
  createEntertainmentSign,
  createEntertainmentSky,
  createEntertainmentWheel,
  createEntertainmentWires,
} from '@/features/location/rendering/entertainment-ground';
import { createEntranceHint } from '@/game/rendering/entrance-hint';
import { acquireMapAssets } from '@/game/rendering/map-assets';
import { createPreviewProviders } from '@/game/rendering/renderer-providers';

const attractionIds = ['atm', 'arcade', 'hall', 'auction', 'prizes', 'racing'] as const;
type Attraction = (typeof attractionIds)[number];
export const styles = locationCss;

export function Screen({
  definition,
  audio,
}: {
  audio: ReturnType<typeof createGameAudio>;
  definition?: MapDefinition;
}) {
  const { t } = useTranslation('common');
  const channelRef = useRef<ChannelDirectory | undefined>(undefined);
  const channelVersion = useRef(0);
  const [channelDirectory, setChannelDirectory] = useState<ChannelDirectory>();
  const [channelDialog, setChannelDialog] = useState(false);
  const updateChannels = useCallback((directory: ChannelDirectory) => {
    channelVersion.current++;
    channelRef.current = directory;
    setChannelDirectory(directory);
  }, []);
  const [attraction, setAttraction] = useState<Attraction>();
  const host = useRef<HTMLDivElement>(null);
  const navigation = useRouter();
  const [error, setError] = useState('');
  const [header, setHeader] = useState<{ player: LocationPlayer; coins: number; gems: number }>();
  useEffect(() => {
    channelRef.current = undefined;
    setChannelDirectory(undefined);
    if (!definition?.channels) return;
    let disposed = false;
    const version = channelVersion.current;
    void getApiSdk()
      .getMapChannels({ regionId: definition.regionId, mapId: definition.id })
      .then((data) => {
        if (!disposed && channelVersion.current === version) updateChannels(data);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [definition, updateChannels]);
  useEffect(() => {
    if (!definition) return;
    const map = definition;
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
      setHeader({ player, coins: inventory.farm.coins, gems: inventory.farm.gems });
      const generated = new Map<string, HTMLCanvasElement>();
      if (map.regionId === 'fun') {
        generated.set('entertainment:plaza', await createEntertainmentGround(map.width, 310));
        generated.set('entertainment:wires', await createEntertainmentWires(map.width));
        generated.set('entertainment:garden', createEntertainmentGarden(map.width));
        generated.set('entertainment:sky', createEntertainmentSky(map.width, 520));
      }
      const resource = await acquireMapAssets(map, generated);
      const signSource = resource.assets.get('entertainment:zone-sign');
      let renderedChannel: number | undefined;
      if (map.regionId === 'fun') {
        const pole = resource.assets.get('entertainment:utility-pole');
        if (pole) resource.assets.set('entertainment:utility-pole', createEntertainmentPole(pole));
        if (signSource)
          resource.assets.set(
            'entertainment:zone-sign',
            createEntertainmentSign(signSource, undefined, t('channelSign')),
          );
        const billboard = resource.assets.get('entertainment:billboard');
        if (billboard) resource.assets.set('entertainment:billboard', createEntertainmentBillboard(billboard));
        const disc = resource.assets.get('entertainment:wheel-disc');
        if (disc) resource.assets.set('entertainment:wheel-disc', createEntertainmentWheel(disc));
      }
      const exitHint = createEntranceHint(t('exitLocation'));
      const entranceHint = map.regionId === 'fun' ? createEntranceHint(t('enterLocation')) : undefined;
      if (disposed) {
        resource.release();
        return;
      }
      release = resource.release;
      const hero = new AvatarState(toEquip(player.outfit));
      let x = map.spawn[0],
        y = map.spawn[1];
      let target: [number, number] | undefined;
      const contactShadow = map.regionId === 'fun' ? createEntertainmentShadow() : undefined;
      /** Maps with channels are shared: show the other players of this channel and report our own position. */
      const realtime = map.channels ? getRealtime() : undefined;
      const others = createRemotePlayers(player.id);
      let enteredChannel: number | undefined;
      let reported = { x, y, at: 0 };
      if (realtime) {
        const unsubscribe = realtime.subscribe(others.apply);
        realtime.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x, y });
        leaveRoom = () => {
          unsubscribe();
          realtime.send({ type: 'map.leave' });
        };
      }
      renderer = providers.create('phaser', {
        parent: host.current!,
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

          target: () => [x, map.regionId === 'fun' ? map.height / 2 : y],
        },
        input: {
          onPointerDown(px, py) {
            if (blocksGameInput()) return;
            const sign = map.layers?.find((layer) => layer.id === 'zone-sign');
            if (
              map.channels &&
              sign &&
              px >= sign.x &&
              px <= sign.x + sign.width &&
              py >= sign.y &&
              py <= sign.y + sign.height
            ) {
              target = undefined;
              setChannelDialog(true);
              return;
            }
            const exit = map.portals.find(
              (portal) =>
                portal.target === 'world' &&
                portal.entrance &&
                Math.abs(px - portal.entrance[0]) <= 36 &&
                py >= portal.entrance[1] - 52 &&
                py <= portal.entrance[1] + 12,
            );
            if (exit) {
              target = undefined;
              navigation.push('/');
              return;
            }
            const hit =
              map.regionId === 'fun' &&
              map.layers?.find(
                (layer) =>
                  (attractionIds.includes(layer.id as Attraction) || layer.id.startsWith('wheel-')) &&
                  ((px >= layer.x && px <= layer.x + layer.width && py >= layer.y && py <= layer.y + layer.height) ||
                    (layer.entrance &&
                      Math.abs(px - layer.entrance[0]) <= 28 &&
                      py >= layer.entrance[1] &&
                      py <= layer.entrance[1] + 44)),
              );
            if (hit) {
              target = undefined;
              if (hit.destination) navigation.push(`/play/${hit.destination.regionId}/${hit.destination.mapId}`);
              else setAttraction(hit.id.startsWith('wheel-') ? 'prizes' : (hit.id as Attraction));
            } else target = [px, py];
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
          const channelId = channelRef.current?.currentChannelId;
          if (signSource && channelId !== renderedChannel) {
            resource.assets.set(
              'entertainment:zone-sign',
              createEntertainmentSign(signSource, channelId, t('channelSign')),
            );
            renderedChannel = channelId;
          }
          const dt = Math.min(delta / 1000, 0.05);
          const direction = input?.direction ?? [0, 0];
          let dx = direction[0],
            dy = direction[1];
          if (blocksGameInput()) {
            dx = 0;
            dy = 0;
          } else if (dx || dy) target = undefined;
          else if (target) {
            dx = target[0] - x;
            dy = target[1] - y;
            if (Math.hypot(dx, dy) < 3) {
              target = undefined;
              dx = 0;
              dy = 0;
            }
          }
          const distance = Math.hypot(dx, dy);
          if (distance) {
            [x, y] = moveInLocation(
              map,
              [x, y],
              [
                (dx / distance) * (target ? Math.min(distance, 100 * dt) : 100 * dt),
                (dy / distance) * (target ? Math.min(distance, 100 * dt) : 100 * dt),
              ],
            );
            if (dx) hero.mirror = dx < 0;
          }
          hero.setAction(distance ? Action.Walk : Action.Stand);
          others.step(dt);
          if (realtime) {
            // The server picks the channel from the saved choice, so a channel switch means entering again.
            if (channelId !== undefined && channelId !== enteredChannel) {
              if (enteredChannel !== undefined)
                realtime.send({ type: 'map.enter', regionId: map.regionId, mapId: map.id, x, y });
              enteredChannel = channelId;
              reported = { x, y, at: now };
            } else if ((reported.x !== x || reported.y !== y) && now - reported.at >= 150) {
              realtime.send({ type: 'map.move', x: Math.round(x), y: Math.round(y) });
              reported = { x, y, at: now };
            }
          }
          view.beginFrame();
          const draw = (map.layers ?? []).map((layer) => ({
            depth: layer.depth,

            paint: () => {
              const asset = layer.asset ? resource.assets.get(layer.asset) : undefined;
              if (asset) {
                view.surface(
                  layer.id === 'zone-sign'
                    ? `${layer.asset}:channel-${renderedChannel ?? 'loading'}`
                    : (layer.asset ?? layer.id),
                  asset,
                  layer.x +
                    (layer.drift
                      ? Math.sin((now / (layer.drift.seconds * 1000)) * Math.PI * 2) * layer.drift.distance
                      : 0),
                  layer.y,
                  layer.width,
                  layer.height,
                  layer.rotationSeconds ? ((now / (layer.rotationSeconds * 1000)) % 1) * Math.PI * 2 : 0,
                );
              } else if (layer.color !== undefined)
                view.rectangle(layer.x, layer.y, layer.width, layer.height, layer.color);
            },
          }));
          if (contactShadow) {
            for (const layer of map.layers ?? []) {
              if (
                layer.entrance ||
                /^(back-tree|front-evergreen|shop-evergreen|lamp-|bin$|hydrant$|zone-sign)/.test(layer.id)
              ) {
                const width = layer.width * 0.85;
                draw.push({
                  depth: layer.depth - 0.5,

                  paint: () =>
                    view.surface(
                      'contact-shadow',
                      contactShadow,
                      layer.x + (layer.width - width) / 2,
                      layer.y + layer.height - 8,
                      width,
                      layer.entrance ? 15 : 12,
                    ),
                });
              }
            }
            const billboard = map.layers?.find((layer) => layer.id === 'billboard');
            if (billboard) {
              // Source foot centers/baselines, including the restored outer-post padding.
              for (const [fx, fy, footWidth] of [
                [24, 146, 28],
                [79, 145, 25],
                [180, 146, 25],
                [277, 145, 25],
                [342, 146, 28],
              ]) {
                const width = (footWidth * billboard.width) / 369;
                draw.push({
                  depth: billboard.depth - 0.2,

                  paint: () =>
                    view.surface(
                      'contact-shadow',
                      contactShadow,
                      billboard.x + (fx * billboard.width) / 369 - width / 2,
                      billboard.y + (fy * billboard.height) / 152 - 3,
                      width,
                      7,
                    ),
                });
              }
            }
            draw.push({
              depth: y - 0.1,

              paint: () => view.surface('contact-shadow', contactShadow, x - 15, y - 4, 30, 8),
            });
          }
          draw.push({
            depth: y,

            paint: () =>
              view.drawPieces(
                'character',
                sheet,
                layoutAvatar(items, sheet, hero.visibleEquip(items), hero.pose, hero.mirror, now),
                x,
                y,
              ),
          });
          for (const other of others.players.values()) {
            if (contactShadow)
              draw.push({
                depth: other.y - 0.1,

                paint: () => view.surface('contact-shadow', contactShadow, other.x - 15, other.y - 4, 30, 8),
              });
            draw.push({
              depth: other.y,

              paint: () =>
                view.drawPieces(
                  'character',
                  sheet,
                  layoutAvatar(
                    items,
                    sheet,
                    other.avatar.visibleEquip(items),
                    other.avatar.pose,
                    other.avatar.mirror,
                    now,
                  ),
                  other.x,
                  other.y,
                ),
            });
          }
          draw
            .sort((a, b) => a.depth - b.depth)
            .forEach((item) => {
              item.paint();
            });
          if (map.regionId === 'fun') {
            for (const layer of map.layers ?? []) {
              if (layer.entrance && entranceHint)
                view.surface(
                  'location-entrance-hint',
                  entranceHint,
                  layer.entrance[0] - 32,
                  layer.entrance[1] - 22 + Math.sin(now / 330) * 1.5,
                  64,
                  48,
                );
            }
          }
          for (const portal of map.portals) {
            if (portal.target === 'world' && portal.entrance)
              view.surface(
                'location-exit-hint',
                exitHint,
                portal.entrance[0] - 21,
                portal.entrance[1] - 32 + Math.sin(now / 330) * 1.5,
                42,
                32,
              );
          }
          view.label(`LV${player.level} ${player.name}`, Math.round(x), Math.round(y) - 78, '#ffe066');
          for (const other of others.players.values())
            view.label(`LV${other.level} ${other.name}`, Math.round(other.x), Math.round(other.y) - 78, '#ffffff');
          view.endFrame();
        },
      });
    }

    void start().catch(() => {
      if (!disposed) setError(t('locationLoadFailed'));
    });
    return () => {
      disposed = true;
      leaveRoom?.();
      renderer?.destroy();
      release?.();
    };
  }, [definition, t, navigation.push]);
  return (
    <LocationLayout
      title={definition?.label ?? t('locationLabel')}
      player={header?.player}
      coins={header?.coins}
      gems={header?.gems}
      audio={audio}
      menuActions={
        definition?.channels && (
          <Button onClick={() => setChannelDialog(true)}>
            <span>{t('channelsTitle')}</span>
            <span className="ui-menu-value">
              {t('channelNumber', { id: channelDirectory?.currentChannelId ?? '…' })}
            </span>
          </Button>
        )
      }
    >
      <div className="location-canvas" ref={host} />
      <nav className="location-portals" aria-label={t('locationLabel')}>
        {definition?.portals
          .filter((portal) => portal.target !== 'world')
          .map((portal) => (
            <Button
              key={portal.id}
              onClick={() => {
                if (portal.target === 'world') navigation.push('/');
                else
                  void getApiSdk()
                    .getWorld()
                    .then((world) => {
                      const destination = world.maps.find((map) => map.id === portal.target);
                      if (destination)
                        navigation.push(
                          `/play/${destination.regionId}/${destination.id}?spawn=${portal.spawn.join(',')}`,
                        );
                    });
              }}
            >
              {t('locationPortal', { name: portal.id })}
            </Button>
          ))}
        {error && <p role="alert">{error}</p>}
      </nav>
      {definition?.regionId === 'fun' && <div className="location-hint">{t('entertainmentHint')}</div>}
      {channelDialog && definition?.channels && (
        <ChannelDialog
          map={{ regionId: definition.regionId, mapId: definition.id }}
          onChanged={updateChannels}
          onClose={() => setChannelDialog(false)}
        />
      )}
      {attraction && (
        <Dialog title={t(`attractions.${attraction}`)} onClose={() => setAttraction(undefined)} closeLabel={t('close')}>
          <p>{t('entertainmentPreview')}</p>
        </Dialog>
      )}
    </LocationLayout>
  );
}
