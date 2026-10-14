import type { DrawOp, Equip, ItemDef, PoseEntry } from './character-types.js';
import hatFit from './data/hat-fit.json' with { type: 'json' };
import type { SpriteSheet } from './sprite-types.js';

/** Shared attachment anchor for sprites, hair masks and hat effects. */
export function equippedPose(items: Record<string, ItemDef>, equip: Equip[], item: ItemDef, pose: number): PoseEntry {
  const base = item.poses[pose] ?? item.poses[0];
  if (item.slot !== 'hat' || !equip.some((e) => items[e.item]?.gender === 'female')) return base;
  const family = item.id.split('.')[1] as keyof typeof hatFit.female;
  const offset = hatFit.female[family];
  return offset ? { ...base, dx: base.dx + offset[0], dy: base.dy + offset[1] } : base;
}

/** Piece an item shows at `time` ms: its pose piece, or the current frame of an animated item. */
export function framePiece(item: ItemDef, piece: string, time: number): string {
  if (!item.frames?.length || !item.frameMs) return piece;
  const frame = Math.floor(Math.max(0, time) / item.frameMs) % item.frames.length;
  return piece + item.frames[frame];
}

/**
 * Lay out an avatar's pieces in draw order (J2ME `fa.a`). Mirrored, a piece at offset dx with
 * width w is flipped and reflected about the origin: x + dx − (2·dx + w) = x − dx − w.
 * `time` (ms) drives animated items such as flapping wings.
 */
export function layoutAvatar(
  items: Record<string, ItemDef>,
  sheet: SpriteSheet,
  equip: Equip[],
  pose: number,
  mirror: boolean,
  time = 0,
): DrawOp[] {
  // Hats specify the brim's hair attachment line relative to their pose origin.
  const hat = equip.map((e) => items[e.item]).find((i) => i?.slot === 'hat' && i.hairBelow !== undefined);
  const clipTop = hat ? equippedPose(items, equip, hat, pose).dy + hat.hairBelow! : undefined;
  return equip
    .map((e) => ({ e, item: items[e.item] }))
    .filter((o) => o.item)
    .sort((a, b) => a.item.layer - b.item.layer)
    .map(({ e, item }) => {
      const { dx, dy } = equippedPose(items, equip, item, pose);
      const piece = framePiece(item, (item.poses[pose] ?? item.poses[0]).piece, time);
      const width = sheet.pieces[piece].width;
      let clipSpans: [number, number][] | undefined;
      if (hat && clipTop !== undefined && item.slot === 'hairBack' && item.gender === 'female') {
        const exposedPonytail = item.id.startsWith('hair.female-ponytail.back');
        const hp = equippedPose(items, equip, hat, pose);
        const hatRows = sheet.pieces[framePiece(hat, hp.piece, time)].rows;
        // A narrow cone still contains the entire scalp underneath its brim.
        // Sweep the brim silhouette upward to hide the rear scalp beside the
        // cone, while retaining a tied tail outside that envelope.
        const brimRow = Math.min(hatRows.length - 1, Math.floor(clipTop - hp.dy));
        const envelope: [number, number][] = [];
        let left = Infinity;
        let right = -Infinity;
        for (let y = brimRow; y >= 0; y--) {
          const columns = [...hatRows[y]].flatMap((c, x) => (c === '.' ? [] : [x]));
          if (columns.length) {
            left = Math.min(left, ...columns);
            right = Math.max(right, ...columns.map((x) => x + 1));
          }
          envelope[y] = [left, right];
        }
        clipSpans = sheet.pieces[piece].rows.map((_, y) => {
          const depth = Math.max(0, clipTop - (dy + y));
          // Loose hair keeps its entire crown inside the covering hat above
          // the transition; a tied tail can emerge outside the brim envelope.
          if (depth >= 4 && !exposedPonytail) return [0, width];
          const row = Math.max(0, Math.min(brimRow, dy + y - hp.dy));
          const [start, end] = envelope[row];
          // Taper the rear exit into the brim instead of leaving a thin vertical
          // strip of the ponytail root hanging beside a tall hat.
          // A tied tail sits outside the hat: preserve its curved root instead
          // of cutting the whole rear layer at a horizontal brim line.
          const taper = exposedPonytail ? 0 : Math.ceil(4 * Math.sqrt(depth));
          return [hp.dx + start - dx - taper, hp.dx + end - dx + taper];
        });
      }
      return {
        piece,
        recolor: e.recolor,
        x: mirror ? -dx - width : dx,
        y: dy,
        flip: mirror,
        ...(clipTop !== undefined && ['hair', 'hairBack'].includes(item.slot) ? { clipTop } : {}),
        ...(clipSpans ? { clipSpans } : {}),
      };
    });
}

/** Highest visible native pixel, including equipment and masks, relative to the feet. */
export function avatarTop(sheet: SpriteSheet, ops: DrawOp[]): number {
  let top = Infinity;
  for (const op of ops) {
    const rows = sheet.pieces[op.piece].rows;
    for (let y = 0; y < rows.length; y++) {
      const aboveClip = op.y + y < (op.clipTop ?? op.y);
      if (aboveClip && !op.clipSpans) continue;
      const span = op.clipSpans?.[y];
      if ([...rows[y]].some((c, x) => c !== '.' && !(aboveClip && span && x >= span[0] && x < span[1]))) {
        top = Math.min(top, op.y + y);
        break;
      }
    }
  }
  return Number.isFinite(top) ? top : 0;
}

/** Stable clearance over the whole outfit's poses and animation frames. */
export function nameplateTop(items: Record<string, ItemDef>, sheet: SpriteSheet, equip: Equip[]): number {
  const poses = new Set([0]);
  const times = new Set([0]);
  for (const { item: id } of equip) {
    const item = items[id];
    if (!item) continue;
    for (const pose of Object.keys(item.poses)) poses.add(Number(pose));
    if (item.frameMs) for (let frame = 0; frame < (item.frames?.length ?? 0); frame++) times.add(frame * item.frameMs);
  }
  let top = Infinity;
  for (const pose of poses)
    for (const time of times)
      top = Math.min(top, avatarTop(sheet, layoutAvatar(items, sheet, equip, pose, false, time)));
  return Number.isFinite(top) ? top : 0;
}
