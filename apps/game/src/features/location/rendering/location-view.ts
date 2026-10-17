import type { AvatarState } from '@chibi-town/character-core/animation-logic';
import type { DrawOp } from '@chibi-town/character-core/character-types';
import { items, pets } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import type { MapDefinition } from '@chibi-town/game-content';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import type { TFunction } from 'i18next';
import type { LocationPlayer } from '@/application/_components/location-layout';
import { petSheet, sheet } from '@/assets/asset-catalog';
import type { LocationInputState } from '@/features/location/_utils/location-input-logic';
import type { RemotePlayer } from '@/features/location/_utils/remote-players-logic';
import { createEntertainmentShadow } from '@/features/location/rendering/entertainment-ground';
import { layoutPet } from '@/game/movement/pet-follow-logic';
import { createEntranceHint } from '@/game/rendering/entrance-hint';

export type LocationLabels = TFunction<'common'>;
type Entry = {
  offset?: number;
  depth: number;
  paint(view: CharacterRenderer, now: number): void;
  player?: RemotePlayer | LocationInputState;
};

const byDepth = (a: Entry, b: Entry) => a.depth - b.depth;

const BILLBOARD_FEET = [
  [24, 146, 28],
  [79, 145, 25],
  [180, 146, 25],
  [277, 145, 25],
  [342, 146, 28],
];

/** Static draw entries are prepared once; dynamic entries change only with room membership. */
export function createLocationView(
  map: MapDefinition,
  assets: Map<string, HTMLCanvasElement>,
  state: LocationInputState,
  hero: AvatarState,
  player: LocationPlayer,
  others: Map<string, RemotePlayer>,
  labels: () => LocationLabels,
) {
  const layers = map.layers ?? [];
  const shadow = map.presentation === 'street' ? createEntertainmentShadow() : undefined;
  const draw: Entry[] = [];
  const remoteEntries = new Map<RemotePlayer, Entry[]>();
  let exitText = '',
    enterText = '';
  let exitHint: HTMLCanvasElement, entranceHint: HTMLCanvasElement;
  let signSource: HTMLCanvasElement | undefined;
  let signVersion = 0;
  for (const layer of layers) {
    draw.push({
      depth: layer.depth,

      paint(view, now) {
        const asset = layer.asset ? assets.get(layer.asset) : undefined;
        if (asset) {
          if (layer.id === 'zone-sign' && asset !== signSource) {
            signSource = asset;
            signVersion++;
          }
          view.surface(
            layer.id === 'zone-sign' ? `${layer.asset}:sign-${signVersion}` : (layer.asset ?? layer.id),
            asset,
            layer.x +
              (layer.drift ? Math.sin((now / (layer.drift.seconds * 1000)) * Math.PI * 2) * layer.drift.distance : 0),
            layer.y,
            layer.width,
            layer.height,
            layer.rotationSeconds ? ((now / (layer.rotationSeconds * 1000)) % 1) * Math.PI * 2 : 0,
          );
        } else if (layer.pet && pets[layer.pet]) {
          const piece = pets[layer.pet].piece;
          const native = petSheet.pieces[piece];
          const scale = Math.min(layer.width / native.width, layer.height / native.rows.length);
          view.drawPieces(
            'pet',
            petSheet,
            [{ piece, x: -native.width / 2, y: -native.rows.length, flip: false }],
            layer.x + layer.width / 2,
            layer.y + layer.height,
            scale,
          );
        } else if (layer.color !== undefined) view.rectangle(layer.x, layer.y, layer.width, layer.height, layer.color);
      },
    });
    if (
      shadow &&
      (layer.entrance || /^(back-tree|front-evergreen|shop-evergreen|lamp-|bin$|hydrant$|zone-sign)/.test(layer.id))
    ) {
      const width = layer.width * 0.85;
      draw.push({
        depth: layer.depth - 0.5,

        paint(view) {
          view.surface(
            'contact-shadow',
            shadow,
            layer.x + (layer.width - width) / 2,
            layer.y + layer.height - 8,
            width,
            layer.entrance ? 15 : 12,
          );
        },
      });
    }
    if (shadow && (layer.id === 'bus-stop' || layer.id === 'bus-stop-sign')) {
      const sign = layer.id === 'bus-stop-sign';
      const nativeWidth = sign ? 64 : 250;
      for (const x of sign ? [32] : [8, 240]) {
        draw.push({
          depth: layer.depth - 0.2,

          paint(view) {
            const scale = layer.width / nativeWidth;
            view.surface(
              'contact-shadow',
              shadow,
              layer.x + x * scale - 9,
              layer.y + (128 * layer.height) / 134 - 2,
              18,
              5,
            );
          },
        });
      }
    }
    if (shadow && layer.id === 'billboard')
      for (const [fx, fy, footWidth] of BILLBOARD_FEET) {
        const width = (footWidth * layer.width) / 369;
        draw.push({
          depth: layer.depth - 0.2,

          paint(view) {
            view.surface(
              'contact-shadow',
              shadow,
              layer.x + (fx * layer.width) / 369 - width / 2,
              layer.y + (fy * layer.height) / 152 - 3,
              width,
              7,
            );
          },
        });
      }
  }

  function avatarEntries(at: LocationInputState | RemotePlayer, avatar: AvatarState): Entry[] {
    const pieces = new Map<string, DrawOp[]>();
    const entries: Entry[] = [
      {
        depth: at.y,
        player: at,

        paint(view, now) {
          let key = `${avatar.pose}:${avatar.mirror}:${avatar.blinking}`;
          for (const equipped of avatar.equip) {
            const item = items[equipped.item];
            if (item?.frameMs && item.frames?.length)
              key += `:${Math.floor(Math.max(0, now) / item.frameMs) % item.frames.length}`;
          }
          let ops = pieces.get(key);
          if (!ops) {
            ops = layoutAvatar(items, sheet, avatar.visibleEquip(items), avatar.pose, avatar.mirror, now);
            pieces.set(key, ops);
          }
          view.drawPieces('character', sheet, ops, at.x, at.y);
        },
      },
    ];
    entries.push({
      depth: at.y + 4,
      offset: 4,
      player: at,

      paint(view) {
        if (at.pet) view.drawPieces('pet', petSheet, [layoutPet(at.pet, petSheet)], at.pet.x, at.pet.y);
      },
    });
    if (shadow)
      entries.unshift({
        depth: at.y - 0.1,
        offset: -0.1,
        player: at,

        paint(view) {
          view.surface('contact-shadow', shadow, at.x - 15, at.y - 4, 30, 8);
        },
      });
    return entries;
  }

  draw.push(...avatarEntries(state, hero));
  return (view: CharacterRenderer, now: number) => {
    const t = labels();
    if (t('exitLocation') !== exitText) {
      exitText = t('exitLocation');
      exitHint = createEntranceHint(exitText);
    }
    if (t('enterLocation') !== enterText) {
      enterText = t('enterLocation');
      entranceHint = createEntranceHint(enterText);
    }
    for (const other of remoteEntries.keys())
      if (others.get(other.id) !== other) {
        for (const entry of remoteEntries.get(other)!) draw.splice(draw.indexOf(entry), 1);
        remoteEntries.delete(other);
      }
    for (const other of others.values())
      if (!remoteEntries.has(other)) {
        const entries = avatarEntries(other, other.avatar);
        remoteEntries.set(other, entries);
        draw.push(...entries);
      }
    for (const entry of draw) if (entry.player) entry.depth = entry.player.y + (entry.offset ?? 0);
    draw.sort(byDepth);
    view.beginFrame();
    for (const entry of draw) entry.paint(view, now);
    if (map.presentation === 'street')
      for (const layer of layers)
        if (layer.entrance && (layer.destination || layer.shop || layer.id === 'racing'))
          view.surface(
            `location-entrance-hint:${enterText}`,
            entranceHint,
            layer.entrance[0] - 32,
            layer.entrance[1] - 22 + Math.sin(now / 330) * 1.5,
            64,
            48,
          );
    if (map.presentation === 'interior')
      for (const layer of layers)
        if (layer.shop && layer.shopInteraction)
          view.surface(
            `location-shop-hint:${enterText}`,
            entranceHint,
            layer.shopInteraction[0] - 32,
            layer.shopInteraction[1] - 48 + Math.sin(now / 330) * 1.5,
            64,
            48,
          );
    for (const portal of map.portals)
      if (portal.entrance)
        view.surface(
          `location-exit-hint:${exitText}`,
          exitHint,
          portal.entrance[0] - 21,
          portal.entrance[1] - 32 + Math.sin(now / 330) * 1.5,
          42,
          32,
        );
    view.label(t('avatarName', player), Math.round(state.x), Math.round(state.y) - 78, '#ffe066');
    for (const other of others.values())
      view.label(t('avatarName', other), Math.round(other.x), Math.round(other.y) - 78, '#ffffff');
    view.endFrame();
  };
}
