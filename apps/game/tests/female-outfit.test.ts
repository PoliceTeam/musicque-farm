import { items } from '@chibi-town/character-core/item-catalog';
import { equippedPose, layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { defaultOutfit, femaleOutfit, sanitizeOutfit, toEquip } from '@chibi-town/character-core/outfit-logic';
import { spritePixels } from '@chibi-town/render-contracts/sprite-pixels';
import { describe, expect, it } from 'vitest';
import { sheet } from '@/assets/asset-catalog';

function pixels(op: ReturnType<typeof layoutAvatar>[number]) {
  return sheet.pieces[op.piece].rows.flatMap((row, y) =>
    [...row].flatMap((letter, x) => (letter === '.' ? [] : [[op.x + (op.flip ? row.length - 1 - x : x), op.y + y]])),
  );
}

const hairstyles = Object.values(items).filter(
  (item) => item.slot === 'hair' && item.gender === 'female' && !item.hidden,
);

describe('female starter', () => {
  it('keeps the painted loop and pink fastening visible behind covering hats, without duplicating it bare', () => {
    for (const hat of ['hat.cap', 'hat.beanie', 'hat.wizard'])
      for (const pose of [0, 1, 2, 3])
        for (const mirror of [false, true]) {
          const outfit = { ...femaleOutfit, hair: 'hair.female-ponytail', hat };
          const ops = layoutAvatar(items, sheet, toEquip(outfit), pose, mirror);
          const tie = ops.find((op) => op.piece.includes('ponytail.tie'))!;
          expect(tie).toBeDefined();
          expect(tie.clipTop).toBeUndefined();
          expect(ops.indexOf(tie)).toBeLessThan(ops.findIndex((op) => op.piece.startsWith('hat.')));
          expect(sheet.pieces[tie.piece].rows.join('')).toMatch(/[]/);
          const bareOps = layoutAvatar(items, sheet, toEquip({ ...outfit, hat: '' }), pose, mirror);
          const originalHair = new Set(
            bareOps
              .filter((op) => op.piece.startsWith('hair.female-ponytail'))
              .flatMap(pixels)
              .map(([x, y]) => `${x},${y}`),
          );
          for (const [x, y] of pixels(tie))
            expect(originalHair.has(`${x},${y}`), 'hat bun must retain original hair coordinates').toBe(true);

          expect(
            layoutAvatar(items, sheet, toEquip({ ...outfit, hat: '' }), pose, mirror).some((op) =>
              op.piece.includes('ponytail.tie'),
            ),
          ).toBe(false);
        }
  });
  it('leaves every opaque hat pixel unobstructed by the ponytail across levels, faces, frames and facings', () => {
    for (const face of ['head', 'face.baby', 'face.chubby', 'face.wide'])
      for (const hat of Object.values(items).filter(
        (item) => item.slot === 'hat' && item.hairBelow !== undefined && !item.hidden,
      ))
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true])
            for (const time of [0, 200, 400]) {
              const ops = layoutAvatar(
                items,
                sheet,
                toEquip({
                  ...femaleOutfit,
                  face,
                  hair: 'hair.female-ponytail',
                  hat: hat.id,
                  hatLevel: String(hat.level ?? 1),
                }),
                pose,
                mirror,
                time,
              );
              const visible = new Map<string, string>();
              for (const op of ops) {
                const raster = spritePixels(sheet, op);
                for (let y = 0; y < raster.height; y++)
                  for (let x = 0; x < raster.width; x++)
                    if (raster.data[(y * raster.width + x) * 4 + 3])
                      visible.set(`${op.x + (op.flip ? raster.width - 1 - x : x)},${op.y + y}`, op.piece);
              }
              const wornHat = ops.find((op) => op.piece.startsWith('hat.'))!;
              const obscured = pixels(wornHat).filter(([x, y]) => visible.get(`${x},${y}`) !== wornHat.piece);
              expect(obscured, `${hat.id}: hair covers hat pixels`).toEqual([]);
            }
  });
  it('keeps female eye ink inside the eye apertures instead of sampling cheek or hair edges', () => {
    const ops = layoutAvatar(items, sheet, toEquip({ ...femaleOutfit, hair: '', hat: '' }), 0, false);
    const eyes = ops.find((op) => op.piece === 'eyes.female')!;
    for (const [x, y] of pixels(eyes)) {
      expect((x >= -9 && x <= -3) || (x >= 5 && x <= 9), `stray eye/cheek ink at ${x},${y}`).toBe(true);
      expect(y).toBeGreaterThanOrEqual(-42);
      expect(y).toBeLessThanOrEqual(-34);
    }
  });
  it('fits every hat family and level to the female skull across poses and mirrored facings', () => {
    for (const face of ['head', 'face.baby', 'face.chubby', 'face.wide'])
      for (const hat of Object.values(items).filter((item) => item.slot === 'hat' && !item.hidden))
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true]) {
            const female = toEquip({ ...femaleOutfit, face, hat: hat.id, hatLevel: String(hat.level ?? 1) });
            const male = toEquip({ ...defaultOutfit, face, hat: hat.id, hatLevel: String(hat.level ?? 1) });
            const femaleOps = layoutAvatar(items, sheet, female, pose, mirror);
            const maleOps = layoutAvatar(items, sheet, male, pose, mirror);
            const femaleHat = femaleOps.find((op) => op.piece.startsWith(hat.id))!;
            const maleHat = maleOps.find((op) => op.piece.startsWith(hat.id))!;
            const fitted = items[female.find((e) => items[e.item].slot === 'hat')!.item];
            const anchor = equippedPose(items, female, fitted, pose);
            const femaleCenter = femaleHat.x + sheet.pieces[femaleHat.piece].width / 2;
            const maleCenter = maleHat.x + sheet.pieces[maleHat.piece].width / 2;
            const shift = ['hat.crown', 'hat.halo'].includes(hat.family ?? '') ? 1 : 3;
            expect(femaleCenter - maleCenter).toBe(mirror ? shift : -shift);
            expect(femaleHat.y).toBe(anchor.dy);
            expect(femaleHat.x).toBe(mirror ? -anchor.dx - sheet.pieces[anchor.piece].width : anchor.dx);
            const maleItem = items[male.find((e) => items[e.item].slot === 'hat')!.item];
            expect(equippedPose(items, male, maleItem, pose)).toEqual(maleItem.poses[pose]);
          }
  });
  it.each(hairstyles.filter((hair) => hair.id !== 'hair.female-ponytail'))(
    'keeps $id roots hidden under every covering hat and lower locks intact',
    (hair) => {
      for (const face of ['head', 'face.baby', 'face.chubby', 'face.wide'])
        for (const hat of Object.values(items).filter(
          (item) => item.slot === 'hat' && item.hairBelow !== undefined && !item.hidden,
        ))
          for (const pose of [0, 1, 2, 3])
            for (const mirror of [false, true]) {
              const outfit = { ...femaleOutfit, hair: hair.id, face, hat: hat.id, hatLevel: String(hat.level ?? 1) };
              const ops = layoutAvatar(items, sheet, toEquip(outfit), pose, mirror);
              const rear = ops.find((op) => op.piece.startsWith(hair.id) && op.piece.includes('.back'))!;
              const pixels = spritePixels(sheet, rear);
              const rootRows = Math.max(0, Math.floor(rear.clipTop! - 4 - rear.y));
              expect(
                pixels.data.subarray(0, rootRows * pixels.width * 4).every((v) => v === 0),
                `${hair.id}/${face}/${hat.id}/${pose}/${mirror}: rear crown above brim`,
              ).toBe(true);
              const bare = spritePixels(sheet, { ...rear, clipTop: undefined, clipSpans: undefined });
              const below = Math.max(0, Math.ceil(rear.clipTop! - rear.y)) * pixels.width * 4;
              expect(pixels.data.subarray(below)).toEqual(bare.data.subarray(below));
            }
    },
  );
  it('preserves the exposed ponytail root outside every covering hat and restores it when removed', () => {
    for (const face of ['head', 'face.wide'])
      for (const hat of Object.values(items).filter(
        (item) => item.slot === 'hat' && item.hairBelow !== undefined && !item.hidden,
      ))
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true]) {
            const outfit = {
              ...femaleOutfit,
              hair: 'hair.female-ponytail',
              face,
              hat: hat.id,
              hatLevel: String(hat.level ?? 1),
            };
            const ops = layoutAvatar(items, sheet, toEquip(outfit), pose, mirror);
            const rear = ops.find((op) => op.piece.includes('female-ponytail.back'))!;
            const front = ops.find((op) => op.piece.startsWith('hair.') && !op.piece.includes('.back'))!;
            expect(rear.clipSpans).toBeDefined();
            expect(front.clipSpans).toBeUndefined();
            const pixels = spritePixels(sheet, rear);
            const source = sheet.pieces[rear.piece];
            let preserved = 0;
            let exposedRoot = 0;
            const hatOp = ops.find((op) => op.piece.startsWith(hat.id))!;
            const wornHat = items[hatOp.piece];
            const hatPose = equippedPose(items, toEquip(outfit), wornHat, pose);
            const hatRight = hatPose.dx + sheet.pieces[hatPose.piece].width;
            const rearPose = items[rear.piece].poses[pose] ?? items[rear.piece].poses[0];
            source.rows.forEach((row, y) => {
              if (rear.y + y >= rear.clipTop!) {
                preserved += [...row].filter((c) => c !== '.').length;
                return;
              }
              const [start, end] = rear.clipSpans![y];
              [...row].forEach((c, x) => {
                if (c === '.') return;
                const visible = x < start || x >= end;
                expect(pixels.data[(y * source.width + x) * 4 + 3]).toBe(visible ? 255 : 0);
                const worldX = rearPose.dx + x;
                if (worldX < hatPose.dx || worldX >= hatRight) {
                  expect(visible, `${face}/${hat.id}/${pose}: tail outside hat silhouette`).toBe(true);
                  exposedRoot++;
                }
                if (visible) preserved++;
              });
            });
            expect(preserved).toBeGreaterThan(0);
            if (hat.id === 'hat.cap.1') expect(exposedRoot).toBeGreaterThan(0);
            const bare = layoutAvatar(items, sheet, toEquip({ ...outfit, hat: '' }), pose, mirror);
            expect(bare.every((op) => op.clipSpans === undefined && op.clipTop === undefined)).toBe(true);
          }
  });
  it('roundtrips the preset and equips back hair automatically without changing the skeleton', () => {
    expect(sanitizeOutfit(femaleOutfit)).toEqual(femaleOutfit);
    const equip = toEquip(femaleOutfit);
    expect(equip.map((e) => e.item)).toContain('body');
    expect(equip.map((e) => e.item)).toContain('hair.female-long.back');
    expect(equip.map((e) => e.item)).toContain('eyes.female');
    for (const { item } of equip) expect(items[item]).toBeDefined();
  });

  it('fits every face and leaves both eyes visible in all walking poses and facings', () => {
    const eyeStyles = Object.values(items).filter((item) => item.slot === 'eyes' && item.gender !== 'male');
    for (const hair of hairstyles)
      for (const eyeStyle of eyeStyles)
        for (const face of Object.values(items).filter((item) => item.slot === 'head')) {
          for (const pose of [0, 1, 2, 3])
            for (const mirror of [false, true]) {
              const ops = layoutAvatar(
                items,
                sheet,
                toEquip({ ...femaleOutfit, hair: hair.id, face: face.id, eyes: eyeStyle.id }),
                pose,
                mirror,
              );
              const foreground = ops.find((op) => op.piece.startsWith(hair.id) && !op.piece.includes('.back'))!;
              const eyes = ops.find((op) => op.piece.startsWith('eyes.'))!;
              const hairPixels = new Set(pixels(foreground).map((pixel) => pixel.join(',')));
              for (const pixel of pixels(eyes))
                expect(hairPixels.has(pixel.join(',')), `${hair.id}/${eyeStyle.id}/${face.id}/${pose}/${mirror}`).toBe(
                  false,
                );
            }
        }
  }, 20_000);

  it('keeps the skirt hem above shoes and preserves each shoe pose footprint', () => {
    const skirt = items['pants.female'].poses[0];
    expect(skirt.dy + sheet.pieces[skirt.piece].height).toBe(-9);
    for (const pose of [0, 2, 3]) {
      const original = items.shoes.poses[pose];
      const female = items['shoes.female'].poses[pose];
      expect([female.dx, female.dy]).toEqual([original.dx, original.dy]);
      expect(sheet.pieces[female.piece].rows.map((row) => row.replace(/[^.]/g, 'x'))).toEqual(
        sheet.pieces[original.piece].rows.map((row) => row.replace(/[^.]/g, 'x')),
      );
    }
  });

  it('seals hair to every face without background cracks at the temples and nape', () => {
    for (const hair of hairstyles)
      for (const face of Object.values(items).filter((item) => item.slot === 'head'))
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true]) {
            const ops = layoutAvatar(
              items,
              sheet,
              toEquip({ ...femaleOutfit, hair: hair.id, face: face.id }),
              pose,
              mirror,
            );
            const coverage = ops
              .filter((op) => op.piece.startsWith(hair.id) || op.piece === face.poses[0].piece)
              .flatMap(pixels);
            const bob = pose ? 1 : 0;
            for (let y = -46 + bob; y <= -28 + bob; y++) {
              const row = new Set(coverage.filter((pixel) => pixel[1] === y).map((pixel) => pixel[0]));
              for (let x = Math.min(...row); x <= Math.max(...row); x++)
                expect(row.has(x), `${hair.id}/${face.id}/${pose}/${mirror}: gap at ${x},${y}`).toBe(true);
            }
          }
  }, 20_000);
});
