import { Action, AvatarState, POSE_COUNT, poseFor } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { loadItems } from '@chibi-town/character-core/item-loader';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { describe, expect, it } from 'vitest';
import { parseSprites } from '@/assets/sprite-parser';

const sheet = parseSprites('@palette\nK #000000\n\n@piece wide\nKKKK\n\n@piece wide.up\nK..K\n\n@piece small\nK\n');

describe('pose table (hn.aN)', () => {
  it('stands on 0/1, and walks stand, step 2, stand, step 3 so the legs take turns', () => {
    expect(Array.from({ length: 10 }, (_, t) => poseFor(Action.Stand, t))).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(Array.from({ length: 10 }, (_, t) => poseFor(Action.Walk, t))).toEqual([0, 0, 2, 2, 2, 0, 0, 3, 3, 3]);
  });

  it('wraps the tick and treats the -2 marker as pose 0', () => {
    expect(poseFor(Action.Walk, 13)).toBe(2);
    expect(poseFor(12, 8)).toBe(0);
  });
});

describe('loadItems', () => {
  it('fills all poses from pose 0', () => {
    const loaded = loadItems(
      { items: [{ id: 'a', label: 'A', slot: 's', layer: 1, poses: { '0': ['wide', -2, -3], '2': ['small', 0, 0] } }] },
      sheet,
    );
    expect(loaded.a.poses).toHaveLength(POSE_COUNT);
    expect(loaded.a.poses[1]).toEqual({ piece: 'wide', dx: -2, dy: -3 });
    expect(loaded.a.poses[2]).toEqual({ piece: 'small', dx: 0, dy: 0 });
  });

  it('rejects missing pieces and pose 0', () => {
    expect(() =>
      loadItems({ items: [{ id: 'a', label: 'A', slot: 's', layer: 1, poses: { '0': ['nope', 0, 0] } }] }, sheet),
    ).toThrow(/missing piece/);
    expect(() =>
      loadItems({ items: [{ id: 'a', label: 'A', slot: 's', layer: 1, poses: { '1': ['wide', 0, 0] } }] }, sheet),
    ).toThrow(/pose 0/);
  });
});

describe('layoutAvatar (fa.a)', () => {
  const two = loadItems(
    {
      items: [
        { id: 'top', label: 'Top', slot: 't', layer: 20, poses: { '0': ['small', 1, -1] } },
        { id: 'base', label: 'Base', slot: 'b', layer: 10, poses: { '0': ['wide', -1, -5] } },
      ],
    },
    sheet,
  );

  it('draws in layer order', () => {
    const ops = layoutAvatar(two, sheet, [{ item: 'top' }, { item: 'base' }], 0, false);
    expect(ops.map((o) => o.piece)).toEqual(['wide', 'small']);
  });

  it('mirrors about the origin: x = -dx - width', () => {
    const [base, top] = layoutAvatar(two, sheet, [{ item: 'base' }, { item: 'top' }], 0, true);
    expect(base).toMatchObject({ x: 1 - 4, y: -5, flip: true });
    expect(top).toMatchObject({ x: -1 - 1, y: -1, flip: true });
  });

  it('cycles the frames of an animated item over time', () => {
    const flap = loadItems(
      {
        items: [
          {
            id: 'w',
            label: 'W',
            slot: 'back',
            layer: 1,
            frames: ['', '.up'],
            frameMs: 100,
            poses: { '0': ['wide', -2, -4] },
          },
        ],
      },
      sheet,
    );

    const at = (time: number) => layoutAvatar(flap, sheet, [{ item: 'w' }], 0, false, time)[0].piece;

    expect([0, 99, 100, 199, 200].map(at)).toEqual(['wide', 'wide', 'wide.up', 'wide.up', 'wide']);
    expect(layoutAvatar(flap, sheet, [{ item: 'w' }], 0, true, 150)[0]).toMatchObject({ piece: 'wide.up', x: 2 - 4 });
  });

  it('rejects missing or resized frames', () => {
    const item = (frames: string[]) => ({
      id: 'w',
      label: 'W',
      slot: 'back',
      layer: 1,
      frames,
      frameMs: 100,
      poses: { '0': ['wide', 0, 0] as [string, number, number] },
    });

    expect(() => loadItems({ items: [item(['', '.down'])] }, sheet)).toThrow(/missing frame/);
    expect(() =>
      loadItems(
        { items: [{ ...item(['']), poses: { '0': ['small', 0, 0] } }] },
        parseSprites('@palette\nK #000000\n\n@piece small\nK\n\n@piece small.x\nKK\n'),
      ),
    ).not.toThrow();
    expect(() =>
      loadItems(
        { items: [{ ...item(['', '.x']), poses: { '0': ['small', 0, 0] } }] },
        parseSprites('@palette\nK #000000\n\n@piece small\nK\n\n@piece small.x\nKK\n'),
      ),
    ).toThrow(/not the size/);
  });

  it('skips unknown items', () => {
    expect(layoutAvatar(two, sheet, [{ item: 'ghost' }, { item: 'top' }], 0, false)).toHaveLength(1);
  });
});

describe('AvatarState', () => {
  it('does not blink eyes that are already closed', () => {
    const a = new AvatarState([{ item: 'eyes.happy' }], () => 0);
    for (let i = 0; i < 60; i++) {
      a.step();
      expect(a.visibleEquip(items)[0].item).toBe('eyes.happy');
    }
  });

  it('starts a walk on the step pose at the next tick', () => {
    const a = new AvatarState([]);
    a.setAction(Action.Walk);
    a.step();
    expect(a.pose).toBe(2);
  });

  it('swaps the eyes for the blink item while blinking', () => {
    const a = new AvatarState([{ item: 'body' }, { item: 'eyes.big' }], () => 0);
    let blinked = false;
    for (let i = 0; i < 60 && !blinked; i++) {
      a.step();
      blinked = a.visibleEquip(items).some((e) => e.item === 'eyes.blink');
    }
    expect(blinked).toBe(true);
    expect(a.equip.map((e) => e.item)).toEqual(['body', 'eyes.big']);
  });
});
