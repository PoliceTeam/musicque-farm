import { familiesInSlot, items, pets } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import {
  defaultOutfit,
  fieldOptions,
  gokuOutfit,
  outfitFields,
  randomOutfit,
  sanitizeOutfit,
  toEquip,
  wornPet,
} from '@chibi-town/character-core/outfit-logic';
import { seededRandom } from '@chibi-town/character-core/random';
import { describe, expect, it } from 'vitest';
import { petSheet, sheet } from '@/assets/asset-catalog';

describe('outfit', () => {
  it('equips only existing items', () => {
    for (let seed = 1; seed < 30; seed++) {
      for (const e of toEquip(randomOutfit(seededRandom(seed)))) expect(items, e.item).toHaveProperty(e.item);
    }
  });

  it('drops unknown or wrong-slot values from saved data', () => {
    const o = sanitizeOutfit({ hair: 'shirt.tank', hairColor: 'Cầu vồng', shirt: '', extra: 1 });
    expect(o.hair).toBe(defaultOutfit.hair);
    expect(o.hairColor).toBe(defaultOutfit.hairColor);
    expect(o.shirt).toBe('');
    expect(sanitizeOutfit('garbage')).toEqual(defaultOutfit);
  });

  it('never offers hidden items (the blink eyes)', () => {
    for (let seed = 1; seed < 50; seed++) expect(randomOutfit(seededRandom(seed)).eyes).not.toBe('eyes.blink');
  });
});

describe('optional slots and skin', () => {
  it('leaves out empty optional slots and equips chosen ones', () => {
    const plain = toEquip(defaultOutfit).map((e) => e.item);
    expect(plain).not.toContain('');
    const dressed = toEquip({
      ...defaultOutfit,
      back: 'wings.angel',
      held: 'held.balloon',
      sticker: 'sticker.star',
    }).map((e) => e.item);
    expect(dressed).toEqual(expect.arrayContaining(['wings.angel.1', 'held.balloon', 'sticker.star']));
  });

  it('allows no hair', () => {
    const bald = toEquip({ ...defaultOutfit, hair: '' }).map((e) => e.item);
    expect(bald).not.toContain(defaultOutfit.hair);
    expect(bald).toEqual(expect.arrayContaining(['body', 'head']));
    expect(sanitizeOutfit({ ...defaultOutfit, hair: '' }).hair).toBe('');
  });

  it('keeps an empty optional slot from saved data but rejects items from another slot', () => {
    expect(sanitizeOutfit({ ...defaultOutfit, back: '' }).back).toBe('');
    expect(sanitizeOutfit({ ...defaultOutfit, back: 'held.can' }).back).toBe(defaultOutfit.back);
    expect(sanitizeOutfit({ ...defaultOutfit, shoes: '' }).shoes).toBe('');
  });

  it('applies one recolour to every item, so skin-coloured hair shadows follow the skin tone', () => {
    const equip = toEquip({ ...defaultOutfit, skin: 'Nâu', hairColor: 'Vàng' });

    const by = (id: string) => equip.find((e) => e.item === id)!;

    expect(by('hair.mop').recolor?.s).toBe(by('head').recolor?.s);
    expect(by('hair.mop').recolor?.H).not.toBe(by('head').recolor?.s);
  });

  it('adds the back of the hair and the gripping fingers when needed', () => {
    const items = toEquip({ ...defaultOutfit, held: 'held.flower' }).map((e) => e.item);
    expect(items).toEqual(expect.arrayContaining(['hair.mop', 'hair.mop.back', 'held.flower', 'hand.grip']));
    expect(toEquip({ ...defaultOutfit, hair: '' }).map((e) => e.item)).not.toContain('hair.mop.back');
  });
});

describe('upgradable wings', () => {
  it('has six families with six levels each', () => {
    expect(
      familiesInSlot('back')
        .map((f) => f.id)
        .sort(),
    ).toEqual(['wings.angel', 'wings.dragon', 'wings.fairy', 'wings.fire', 'wings.ice', 'wings.shadow']);
    for (const f of familiesInSlot('back')) expect(f.levels).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('wears the chosen family at the chosen level', () => {
    const at = (backLevel: string) => toEquip({ ...defaultOutfit, back: 'wings.fire', backLevel }).map((e) => e.item);

    expect(at('1')).toContain('wings.fire.1');
    expect(at('6')).toContain('wings.fire.6');
    expect(at('6')).not.toContain('wings.fire.1');
  });

  it('flaps: every wing has at least three different frames (open, half, folded)', () => {
    for (const f of familiesInSlot('back'))
      for (const level of f.levels) {
        const item = items[`${f.id}.${level}`];
        const frames = (item.frames ?? []).map((sfx) => sheet.pieces[item.poses[0].piece + sfx]);
        expect(frames.length, item.id).toBeGreaterThanOrEqual(3);
        expect(new Set(frames.map((p) => p.rows.join('\n'))).size, item.id).toBeGreaterThanOrEqual(3);
      }
  });

  it('keeps a gap between the two wings, behind the back', () => {
    for (const f of familiesInSlot('back'))
      for (const level of f.levels) {
        const item = items[`${f.id}.${level}`];
        const { piece, dx } = item.poses[0];
        const p = sheet.pieces[piece];

        const empty = (x: number) => p.rows.every((r) => r[x] === '.');

        // Columns around the middle of the piece are fully transparent: the halves don't touch.
        const mid = Math.floor(p.width / 2);
        let gap = 0;
        for (let x = mid - 8; x <= mid + 8; x++) if (empty(x)) gap++;
        expect(gap, item.id).toBeGreaterThanOrEqual(8);
        expect(dx + mid, item.id).toBeGreaterThan(-8);
      }
  });

  it('shows every wing beside the character in every flap frame, not hidden behind hair and body', () => {
    // Columns the dressed character covers (hair is the widest part).
    const ops = layoutAvatar(items, sheet, toEquip(defaultOutfit), 0, false);
    const left = Math.min(...ops.map((o) => o.x));
    const right = Math.max(...ops.map((o) => o.x + sheet.pieces[o.piece].width));
    for (const f of familiesInSlot('back'))
      for (const level of f.levels) {
        const item = items[`${f.id}.${level}`];
        for (const sfx of item.frames ?? ['']) {
          const p = sheet.pieces[item.poses[0].piece + sfx];
          let outside = 0;
          p.rows.forEach((r) => {
            [...r].forEach((c, x) => {
              const X = item.poses[0].dx + x;
              if (c !== '.' && (X < left || X >= right)) outside++;
            });
          });
          expect(outside, item.id + sfx).toBeGreaterThanOrEqual(25);
        }
      }
  });

  it('keeps a valid level from saved data and drops a bad one', () => {
    expect(sanitizeOutfit({ ...defaultOutfit, back: 'wings.ice', backLevel: '4' })).toMatchObject({
      back: 'wings.ice',
      backLevel: '4',
    });
    expect(sanitizeOutfit({ ...defaultOutfit, backLevel: '9' }).backLevel).toBe(defaultOutfit.backLevel);
    expect(sanitizeOutfit({ ...defaultOutfit, back: 'wings.ice.4' }).back).toBe(defaultOutfit.back);
  });
});

describe('face shapes', () => {
  // Opaque pixels of the laid-out items, as "x,y" keys relative to the origin.
  const pixels = (equip: { item: string }[]) => {
    const set = new Set<string>();
    for (const op of layoutAvatar(items, sheet, equip, 0, false))
      sheet.pieces[op.piece].rows.forEach((r, j) => {
        [...r].forEach((c, i) => {
          if (c !== '.') set.add(`${op.x + i},${op.y + j}`);
        });
      });
    return set;
  };

  it('wider faces wear a widened hairstyle that covers the top of the head like the standard one', () => {
    const coverage = (face: string) => {
      const dressed = toEquip({ ...defaultOutfit, face }).map((e) => e.item);
      const head = pixels([{ item: face }]);
      const hair = pixels(dressed.filter((id) => items[id].slot === 'hair').map((item) => ({ item })));
      const top = [...head].filter((k) => Number(k.split(',')[1]) < -44);
      return top.filter((k) => hair.has(k)).length / top.length;
    };

    const base = coverage('head');
    for (const face of Object.values(items).filter((i) => i.slot === 'head')) {
      const dressed = toEquip({ ...defaultOutfit, face: face.id }).map((e) => e.item);
      if (face.wide) expect(dressed, face.id).toContain(`hair.mop.w${face.wide}`);
      else expect(dressed, face.id).toContain('hair.mop');
      expect(coverage(face.id), face.id).toBeGreaterThanOrEqual(base - 0.03);
    }
  });

  it('keeps a saved face and drops an unknown one', () => {
    expect(sanitizeOutfit({ ...defaultOutfit, face: 'face.vline' }).face).toBe('face.vline');
    expect(sanitizeOutfit({ ...defaultOutfit, face: 'hair.mop' }).face).toBe('head');
  });
});

describe('hairstyles', () => {
  const pixels = (equip: { item: string }[], pose = 0, mirror = false) => {
    const set = new Set<string>();
    for (const op of layoutAvatar(items, sheet, equip, pose, mirror))
      sheet.pieces[op.piece].rows.forEach((r, j) => {
        [...r].forEach((c, i) => {
          if (c !== '.') set.add(`${op.x + (op.flip ? r.length - 1 - i : i)},${op.y + j}`);
        });
      });
    return set;
  };

  // the scalp is fully covered; just above the brow the gaps between fringe locks show forehead, as in the reference
  it('offers the new styles, each in the hair colour group and covering the top of the head', () => {
    const styles = fieldOptions(outfitFields.find((f) => f.key === 'hair')!)
      .map(([v]) => v)
      .filter(Boolean);
    expect(styles).toEqual(
      expect.arrayContaining(['hair.mop', 'hair.messy', 'hair.fluffy', 'hair.spiky', 'hair.slick', 'hair.goku']),
    );
    for (const id of styles) {
      const rows = sheet.pieces[items[id].poses[0].piece].rows.join('');
      expect(rows, id).toMatch(/[IhHGL]/);
      const hair = pixels([{ item: id }]);
      // Slick hair exposes a higher, curved forehead instead of a filled straight band.
      const scalpUntil = id === 'hair.slick' ? -51 : -48;
      const top = [...pixels([{ item: 'head' }])].filter((k) => Number(k.split(',')[1]) < scalpUntil);
      expect(top.filter((k) => hair.has(k)).length, id).toBe(top.length);
    }
  });

  it('no hairstyle covers the eyes', () => {
    const eyes = pixels([{ item: 'eyes.big' }]);
    for (const id of fieldOptions(outfitFields.find((f) => f.key === 'hair')!)
      .map(([v]) => v)
      .filter(Boolean)) {
      const hair = pixels([{ item: id }]);
      expect(
        [...eyes].filter((k) => hair.has(k)),
        id,
      ).toEqual([]);
    }
  });

  it('every style has widened copies for wide faces', () => {
    const wides = [
      ...new Set(
        Object.values(items)
          .map((i) => i.wide)
          .filter(Boolean),
      ),
    ];
    for (const id of fieldOptions(outfitFields.find((f) => f.key === 'hair')!)
      .map(([v]) => v)
      .filter(Boolean))
      for (const w of wides) expect(items, `${id}.w${w}`).toHaveProperty(`${id}.w${w}`);
  });

  it('the new hair and temples have no background gaps for any face, pose or direction', () => {
    for (const hair of [
      'hair.messy',
      'hair.fluffy',
      'hair.spiky',
      'hair.slick',
      'hair.goku',
      'hair.goku.2',
      'hair.goku.3',
      'hair.goku.4',
    ])
      for (const face of Object.values(items).filter((i) => i.slot === 'head'))
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true]) {
            const equip = toEquip({ ...defaultOutfit, hair, face: face.id }).filter((e) =>
              ['hair', 'head'].includes(items[e.item].slot),
            );
            const joined = [...pixels(equip, pose, mirror)].map((k) => k.split(',').map(Number));
            const head = layoutAvatar(items, sheet, [{ item: face.id }], pose, mirror)[0];
            // Slick's forehead starts higher; its gaps were above the previous test band.
            const templeTop = hair === 'hair.slick' ? 7 : 10;
            for (let y = head.y + templeTop; y <= head.y + 19; y++) {
              const xs = joined.filter((p) => p[1] === y).map((p) => p[0]);
              expect(new Set(xs).size, `${hair}/${face.id}, pose ${pose}, mirror ${mirror}, y ${y}`).toBe(
                Math.max(...xs) - Math.min(...xs) + 1,
              );
            }
          }
  });
});

describe('evolving pets', () => {
  const species = [
    'cat',
    'corgi',
    'bunny',
    'chick',
    'slime',
    'dragon',
    'fox',
    'robot',
    'ginger-cat',
    'puppy',
    'deer',
    'panda',
    'pig',
    'turtle',
    'clownfish',
    'songbird',
  ];

  it('every species has three levels, each bigger than the last', () => {
    for (const id of species) {
      const levels = Object.values(pets)
        .filter((p) => p.family === id)
        .sort((a, b) => a.level! - b.level!);
      expect(
        levels.map((p) => p.level),
        id,
      ).toEqual([1, 2, 3]);

      const area = (p: (typeof levels)[0]) => petSheet.pieces[p.piece].width * petSheet.pieces[p.piece].height;

      expect(area(levels[1]), id).toBeGreaterThan(area(levels[0]));
      expect(area(levels[2]), id).toBeGreaterThan(area(levels[1]));
    }
  });

  it('dragons fly at every level; the others walk', () => {
    for (const p of Object.values(pets)) {
      if (p.family === 'dragon') expect(p.flap?.length, p.id).toBeGreaterThanOrEqual(3);
      else expect(p.walk?.length, p.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('the wardrobe picks a species and a level', () => {
    const petField = outfitFields.find((f) => f.key === 'pet')!;
    const levelField = outfitFields.find((f) => f.key === 'petLevel')!;
    expect(
      fieldOptions(petField)
        .map(([v]) => v)
        .filter(Boolean)
        .sort(),
    ).toEqual([...species].sort());
    expect(fieldOptions(levelField).map(([v]) => v)).toEqual(['1', '2', '3']);
    expect(wornPet({ ...defaultOutfit, pet: 'fox', petLevel: '3' })?.id).toBe('fox.3');
    expect(wornPet({ ...defaultOutfit, pet: 'fox', petLevel: '1' })?.id).toBe('fox');
    expect(wornPet({ ...defaultOutfit, pet: '' })).toBeUndefined();
    expect(sanitizeOutfit({ ...defaultOutfit, pet: 'fox.3' }).pet).toBe(defaultOutfit.pet);
  });
});

describe('mouth accessories and pets', () => {
  it('equips a mouth accessory and accepts known pets only', () => {
    expect(toEquip({ ...defaultOutfit, mouthAcc: 'mouthacc.mask' }).map((e) => e.item)).toContain('mouthacc.mask');
    expect(sanitizeOutfit({ ...defaultOutfit, pet: 'cat' }).pet).toBe('cat');
    expect(sanitizeOutfit({ ...defaultOutfit, pet: 'unicorn' }).pet).toBe(defaultOutfit.pet);
  });
});

const HAT_FAMILIES = ['hat.cap', 'hat.beanie', 'hat.wizard', 'hat.crown', 'hat.halo'];

describe('hats', () => {
  it('flaps feather hats without moving the crown, jewel or attachment in any pose or facing', () => {
    const animated = Object.values(items).filter((i) => i.slot === 'hat' && i.frames);
    expect(animated).toHaveLength(12);
    for (const item of animated) {
      expect(item.id).toMatch(/^hat\.(cap\.3|crown\.[45])(\.w\d)?$/);
      const base = sheet.pieces[item.poses[0].piece];
      const frames = item.frames!.map((suffix) => sheet.pieces[item.poses[0].piece + suffix]);
      expect(new Set(frames.map((f) => f.rows.join('\n'))).size).toBe(3);
      for (const frame of frames) {
        expect([frame.width, frame.height]).toEqual([base.width, base.height]);
        base.rows.forEach((row, y) => {
          [...row].forEach((ch, x) => {
            if (Math.abs(x + item.poses[0].dx) <= 7) expect(frame.rows[y][x]).toBe(ch);
          });
        });
      }
      for (const pose of [0, 1, 2, 3])
        for (const mirror of [false, true]) {
          const original = layoutAvatar(items, sheet, [{ item: item.id }], pose, mirror, 0)[0];
          for (let frame = 0; frame < item.frames!.length; frame++) {
            const op = layoutAvatar(items, sheet, [{ item: item.id }], pose, mirror, frame * item.frameMs!)[0];
            expect([op.x, op.y]).toEqual([original.x, original.y]);
            expect(op.piece).toBe(item.poses[pose].piece + item.frames![frame]);
            const sprite = sheet.pieces[op.piece];
            sprite.rows.forEach((row, y) => {
              [...row].forEach((ch) => {
                if (ch !== '.') expect(op.y + y).toBeLessThan(items['eyes.big'].poses[pose].dy);
              });
            });
          }
        }
    }
  });
  it('offers five wizard, crown and halo levels, three for other hats, and migrates old saved outfits', () => {
    expect(familiesInSlot('hat').map((f) => [f.id, f.levels])).toEqual(
      HAT_FAMILIES.map((id) => [
        id,
        ['hat.wizard', 'hat.crown', 'hat.halo'].includes(id) ? [1, 2, 3, 4, 5] : [1, 2, 3],
      ]),
    );
    expect(fieldOptions(outfitFields.find((f) => f.key === 'hatLevel')!).map(([id]) => id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(sanitizeOutfit({ hat: 'hat.wizard', hatLevel: '5' })).toMatchObject({ hat: 'hat.wizard', hatLevel: '5' });
    const levelField = outfitFields.find((f) => f.key === 'hatLevel')!;
    expect(fieldOptions(levelField, { ...defaultOutfit, hat: 'hat.wizard' }).map(([id]) => id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(fieldOptions(levelField, { ...defaultOutfit, hat: 'hat.cap' }).map(([id]) => id)).toEqual(['1', '2', '3']);
    expect(sanitizeOutfit({ hat: 'hat.cap', hatLevel: '5' }).hatLevel).toBe('1');
    expect(sanitizeOutfit({ hair: 'hair.spiky' })).toMatchObject({ hair: 'hair.spiky', hat: '', hatLevel: '1' });
    expect(sanitizeOutfit({ hat: 'hat.cap', hatLevel: '6' }).hatLevel).toBe('1');
    for (const hat of ['hat.bunny', 'hat.horns', 'hat.headset', 'hat.cat', 'hat.knight']) {
      expect(sanitizeOutfit({ hat, hair: 'hair.messy' })).toMatchObject({ hat: '', hair: 'hair.messy' });
      expect(Object.keys(items).some((id) => id.startsWith(`${hat}.`))).toBe(false);
    }
  });

  it('fits all faces and clips only hair under covering hats in every pose and facing', () => {
    for (const family of HAT_FAMILIES)
      for (const face of Object.values(items).filter((i) => i.slot === 'head'))
        for (const hair of ['hair.mop', 'hair.messy', 'hair.fluffy', 'hair.spiky', 'hair.slick', 'hair.goku'])
          for (const level of ['hat.wizard', 'hat.crown', 'hat.halo'].includes(family)
            ? ['1', '2', '3', '4', '5']
            : ['1', '2', '3'])
            for (const pose of [0, 1, 2, 3])
              for (const mirror of [false, true]) {
                const equip = toEquip({ ...defaultOutfit, face: face.id, hair, hat: family, hatLevel: level });
                const hatId = `${family}.${level}${face.wide ? `.w${face.wide}` : ''}`;
                expect(equip.map((e) => e.item)).toContain(hatId);
                const ops = layoutAvatar(items, sheet, equip, pose, mirror);
                const hat = ops.find((op) => op.piece === hatId)!;
                expect(ops.at(-1)).toBe(hat);
                // Open hats (crown, halo, horns, headset) leave the hair alone.
                const below = items[hatId].hairBelow;
                const brim = below === undefined ? undefined : items[hatId].poses[pose].dy + below;
                for (const op of ops) {
                  expect(op.clipTop).toBe(op.piece.startsWith('hair.') ? brim : undefined);
                }
                const eyes = ops.find((op) => op.piece.startsWith('eyes.'))!;
                const cap = sheet.pieces[hat.piece];
                const eye = sheet.pieces[eyes.piece];
                // The brim and ornaments must leave every opaque eye pixel unobstructed.
                const occupied = new Set(
                  cap.rows.flatMap((row, y) =>
                    [...row].flatMap((c, x) =>
                      c === '.' ? [] : [`${hat.x + (mirror ? cap.width - 1 - x : x)},${hat.y + y}`],
                    ),
                  ),
                );
                eye.rows.forEach((row, y) => {
                  [...row].forEach((c, x) => {
                    if (c !== '.')
                      expect(occupied.has(`${eyes.x + (mirror ? eye.width - 1 - x : x)},${eyes.y + y}`)).toBe(false);
                  });
                });
              }
  }, 60_000);

  it('restores the full chosen hairstyle when taking the hat off', () => {
    const o = { ...defaultOutfit, hair: 'hair.spiky' };
    const original = layoutAvatar(items, sheet, toEquip(o), 2, true);
    const dressed = { ...o, hat: 'hat.cap', hatLevel: '3' };
    expect(layoutAvatar(items, sheet, toEquip(dressed), 2, true).some((op) => op.clipTop !== undefined)).toBe(true);
    expect(layoutAvatar(items, sheet, toEquip({ ...dressed, hat: '' }), 2, true)).toEqual(original);
  });
});

describe('Goku basic outfit', () => {
  it('survives saved-outfit validation and equips each separate part', () => {
    expect(sanitizeOutfit(gokuOutfit)).toEqual(gokuOutfit);
    expect(toEquip(gokuOutfit).map((e) => e.item)).toEqual(
      expect.arrayContaining(['hair.goku.1', 'shirt.goku', 'pants.goku', 'shoes.goku', 'wrist.goku']),
    );
  });

  it('inherits the fitted native footprint and anchors of every old part in all poses', () => {
    for (const [id, template] of [
      ['pants.goku', 'pants'],
      ['shoes.goku', 'shoes'],
      ['wrist.goku', 'wrist.band'],
    ])
      for (const pose of [0, 1, 2, 3])
        for (const mirror of [false, true]) {
          const fitted = layoutAvatar(items, sheet, [{ item: id }], pose, mirror)[0];
          const base = layoutAvatar(items, sheet, [{ item: template }], pose, mirror)[0];
          expect([fitted.x, fitted.y, fitted.flip]).toEqual([base.x, base.y, base.flip]);

          const mask = (piece: string) =>
            sheet.pieces[piece].rows.map((row) => [...row].map((c) => (c === '.' ? '.' : '#')).join(''));

          expect(mask(fitted.piece), `${id}/${pose}/${mirror}`).toEqual(mask(base.piece));
        }
  });
});

describe('tail accessories', () => {
  it('offers a generic optional tail field and safely loads older saved outfits', () => {
    const field = outfitFields.find((f) => f.key === 'tail')!;
    expect(field.label).toBe('Đuôi');
    expect(fieldOptions(field)).toContainEqual(['tail.monkey', 'Đuôi khỉ']);
    expect(sanitizeOutfit({ hair: 'hair.spiky' }).tail).toBe('');
    expect(sanitizeOutfit({ tail: 'tail.monkey' }).tail).toBe('tail.monkey');
    expect(sanitizeOutfit({ tail: 'held.nyoibo' }).tail).toBe('');
    expect(toEquip({ ...gokuOutfit, tail: '' }).some((e) => e.item === 'tail.monkey')).toBe(false);
  });

  it('draws the tail behind the body and keeps the staff under the gripping fingers in every pose', () => {
    for (const pose of [0, 1, 2, 3])
      for (const mirror of [false, true]) {
        const ops = layoutAvatar(items, sheet, toEquip(gokuOutfit), pose, mirror);

        const at = (id: string) => ops.findIndex((op) => op.piece === items[id].poses[pose].piece);

        expect(at('tail.monkey')).toBeGreaterThanOrEqual(0);
        expect(at('tail.monkey')).toBeLessThan(at('body'));
        expect(at('held.nyoibo')).toBeLessThan(at('hand.grip'));
      }
  });
});

describe('Goku hair levels', () => {
  it('offers four levels and keeps colour independent of hairstyle', () => {
    const f = outfitFields.find((f) => f.key === 'hairLevel')!;
    expect(fieldOptions(f, gokuOutfit).map(([value]) => value)).toEqual(['1', '2', '3', '4']);
    for (const hairLevel of ['1', '2', '3', '4']) {
      const o = sanitizeOutfit({ ...gokuOutfit, hairLevel, hairColor: 'Trắng' });
      expect(o.hairLevel).toBe(hairLevel);
      expect(o.hairColor).toBe('Trắng');
      expect(toEquip(o).map((e) => e.item)).toContain(`hair.goku.${hairLevel}`);
    }
    expect(sanitizeOutfit({ ...gokuOutfit, hairLevel: '5' }).hairLevel).toBe('1');
  });

  it('puts the long level-four mane behind the body and widens both hair layers', () => {
    for (const face of ['head', 'face.chubby', 'face.wide']) {
      const o = { ...gokuOutfit, hairLevel: '4', face };
      const ids = toEquip(o).map((e) => e.item);
      const suffix = items[face].wide ? `.w${items[face].wide}` : '';
      expect(ids).toContain(`hair.goku.4${suffix}`);
      expect(ids).toContain(`hair.goku.4.back${suffix}`);
      expect(items[`hair.goku.4.back${suffix}`].layer).toBeLessThan(items.body.layer);
      expect(toEquip({ ...o, hairLevel: '2' }).map((e) => e.item)).not.toContain(`hair.goku.4.back${suffix}`);
    }
  });
});
