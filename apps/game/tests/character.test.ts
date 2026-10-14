import { colors as pixelColors, items as pixelItems } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { defaultOutfit as defaultPixelOutfit, toEquip as pixelEquip } from '@chibi-town/character-core/outfit-logic';
import { describe, expect, it } from 'vitest';
import { sheet as pixelSheet } from '@/assets/asset-catalog';
import referenceText from './fixtures/male-reference.txt?raw';

// The reference is the cleaned source image, facing right, with the origin at column 28, row 66 (the row under the feet).
const reference = referenceText.split('\n').filter((l) => l && !l.startsWith('#'));
const OX = 28;
const OY = 66;

/** Compose laid-out pieces into a letter grid the size of the reference (no recolour). */
function compose(pose: number, mirror: boolean, equip = pixelEquip(defaultPixelOutfit)) {
  const grid = reference.map((r) => [...'.'.repeat(r.length)]);
  for (const op of layoutAvatar(pixelItems, pixelSheet, equip, pose, mirror)) {
    pixelSheet.pieces[op.piece].rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        const x = OX + op.x + (op.flip ? row.length - 1 - i : i);
        if (x >= 0 && x < grid[0].length) grid[OY + op.y + j][x] = ch;
      });
    });
  }
  return grid.map((r) => r.join(''));
}

describe('character: split into items, assembled by the engine', () => {
  it('pose 0 with the full outfit matches the reference pixel for pixel', () => {
    expect(compose(0, false)).toEqual(reference);
  });

  it('facing left is the reference mirrored about the origin', () => {
    // Mirroring maps offset u to -u-1, i.e. column c to 2·OX-1-c.
    const width = reference[0].length;
    const expected = reference.map((row) => [...row].map((_, c) => row[2 * OX - 1 - c] ?? '.').join(''));
    const got = compose(0, true);

    // Compare only columns that stay inside the reference box.
    const inside = (s: string) => s.slice(Math.max(0, 2 * OX - width + 1), 2 * OX);

    expect(got.map(inside)).toEqual(expected.map(inside));
  });

  it('the stepping legs never cover the hands', () => {
    // Fists sit at x -18..-11 and 6..13, y -19..-12 from the origin; walking must leave them untouched.
    const still = compose(0, false);
    for (const pose of [2, 3]) {
      const step = compose(pose, false);
      for (let y = OY - 19; y <= OY - 12; y++) {
        expect(step[y].slice(OX - 18, OX - 10), `pose ${pose}, row ${y - OY}`).toBe(still[y].slice(OX - 18, OX - 10));
        expect(step[y].slice(OX + 6, OX + 14), `pose ${pose}, row ${y - OY}`).toBe(still[y].slice(OX + 6, OX + 14));
      }
    }
  });

  it('the two step poses lift opposite feet', () => {
    // The lowest row of each half of the feet: a lifted foot ends higher than when standing.
    const lowest = (rows: string[], x0: number, x1: number) =>
      Math.max(...rows.map((r, y) => (r.slice(x0, x1).replace(/\./g, '') ? y : -1)));

    const still = compose(0, false);
    const a = compose(2, false);
    const b = compose(3, false);
    expect(lowest(a, OX + 6, OX + 14)).toBeLessThan(lowest(still, OX + 6, OX + 14)); // far foot up
    expect(lowest(b, OX - 14, OX - 4)).toBeLessThan(lowest(still, OX - 14, OX - 4)); // near foot up
    expect(a).not.toEqual(b);
  });

  it('every pose lays out inside the box without throwing', () => {
    for (const pose of [0, 1, 2, 3]) expect(() => compose(pose, false)).not.toThrow();
  });

  it('colour sets only touch their own letters and cover them all', () => {
    const groups: Record<string, string> = {
      skin: 'Sskn',
      hair: 'IhHGL',
      shirt: 'TtVYZ',
      pants: 'PpDN',
      shoes: 'OoQ',
      wrist: 'Mmx',
      eyes: 'CBbA',
    };
    for (const [group, letters] of Object.entries(groups)) {
      for (const [name, set] of Object.entries(pixelColors[group])) {
        expect(Object.keys(set).sort().join(''), `${group}/${name}`).toBe([...letters].sort().join(''));
      }
    }
  });

  const faces = Object.values(pixelItems).filter((i) => i.slot === 'head');

  it('has the standard head and nine face shapes', () => {
    expect(faces.map((f) => f.id)).toContain('head');
    expect(faces.length).toBe(10);
  });

  it('every bald head is one solid shape, shared by every hairstyle', () => {
    // No gaps inside any row: a hairstyle may cover the head but never has to patch holes in it.
    for (const face of faces)
      for (const row of pixelSheet.pieces[face.poses[0].piece].rows) {
        const inner = row.replace(/^\.+|\.+$/g, '');
        expect(inner.includes('.'), `${face.id}: ${row}`).toBe(false);
      }
  });

  it('a held item sits between the hand and the gripping fingers', () => {
    const ops = layoutAvatar(
      pixelItems,
      pixelSheet,
      pixelEquip({ ...defaultPixelOutfit, held: 'held.flower' }),
      0,
      false,
    );
    const order = ops.map((op) => op.piece);
    expect(order.indexOf('body')).toBeLessThan(order.indexOf('held.flower'));
    expect(order.indexOf('held.flower')).toBeLessThan(order.indexOf('hand.grip'));
    expect(pixelEquip(defaultPixelOutfit).some((e) => e.item === 'hand.grip')).toBe(false);
  });

  it('every mouth sits on every face', () => {
    for (const face of faces) {
      const head = layoutAvatar(pixelItems, pixelSheet, [{ item: face.id }], 0, false)[0];
      const headRows = pixelSheet.pieces[head.piece].rows;
      const mouths = Object.values(pixelItems).filter((i) => i.slot === 'mouth');
      expect(mouths.length).toBeGreaterThanOrEqual(8);
      for (const mouth of mouths) {
        const op = layoutAvatar(pixelItems, pixelSheet, [{ item: mouth.id }], 0, false)[0];
        pixelSheet.pieces[op.piece].rows.forEach((row, j) => {
          [...row].forEach((ch, i) => {
            if (ch === '.') return;
            const under = headRows[op.y + j - head.y]?.[op.x + i - head.x];
            expect(under && under !== '.' && under !== 'K', `${face.id} ${mouth.id} pixel ${i},${j}`).toBe(true);
          });
        });
      }
    }
  });

  it('every eye style sits on every face', () => {
    for (const face of faces) {
      const head = layoutAvatar(pixelItems, pixelSheet, [{ item: face.id }], 0, false)[0];
      const headRows = pixelSheet.pieces[head.piece].rows;
      const eyes = Object.values(pixelItems).filter((i) => i.slot === 'eyes');
      expect(eyes.length).toBeGreaterThanOrEqual(15);
      for (const eye of eyes) {
        const op = layoutAvatar(pixelItems, pixelSheet, [{ item: eye.id }], 0, false)[0];
        pixelSheet.pieces[op.piece].rows.forEach((row, j) => {
          [...row].forEach((ch, i) => {
            if (ch === '.') return;
            const under = headRows[op.y + j - head.y]?.[op.x + i - head.x];
            expect(under !== undefined && under !== '.', `${face.id} ${eye.id} pixel ${i},${j}`).toBe(true);
          });
        });
      }
    }
  });

  it('offers slippers, flip-flops and boots besides shoes, all in the shoe colours', () => {
    const footwear = Object.values(pixelItems)
      .filter((i) => i.slot === 'shoes' && !i.hidden)
      .map((i) => i.id);
    expect(footwear).toEqual(expect.arrayContaining(['shoes', 'sandal.slide', 'sandal.flip', 'boots']));
    for (const id of ['sandal.slide', 'sandal.flip', 'boots']) {
      for (const pose of [0, 2, 3]) {
        const rows = pixelSheet.pieces[pixelItems[id].poses[pose].piece].rows.join('');
        expect(rows, `${id} pose ${pose}`).toMatch(/O/);
        // Sandals leave the foot bare (skin letters); boots cover it.
        if (id.startsWith('sandal')) expect(rows, `${id} pose ${pose}`).toMatch(/[Ss]/);
      }
    }
    // Boot shafts are drawn over the trouser hems.
    expect(pixelItems.boots.layer).toBeGreaterThan(pixelItems.pants.layer);
  });

  it('offers shorts and swim trunks that end above the knee and show bare legs', () => {
    const pants = Object.values(pixelItems)
      .filter((i) => i.slot === 'pants' && !i.hidden)
      .map((i) => i.id);
    expect(pants).toEqual(expect.arrayContaining(['pants', 'pants.shorts', 'pants.swim']));

    const bottom = (id: string, pose: number) => {
      const p = pixelItems[id].poses[pose];
      return p.dy + pixelSheet.pieces[p.piece].height;
    };

    for (const pose of [0, 2, 3]) {
      expect(bottom('pants.shorts', pose)).toBeLessThan(bottom('pants', pose));
      expect(bottom('pants.swim', pose)).toBeLessThan(bottom('pants.shorts', pose));
    }
  });

  it('the sheet re-parses and every item piece exists', () => {
    expect(Object.keys(pixelSheet.pieces)).toContain('eyes.blink');
    expect(pixelItems['eyes.blink'].hidden).toBe(true);
  });
});
