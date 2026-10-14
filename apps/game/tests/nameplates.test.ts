import { items } from '@chibi-town/character-core/item-catalog';
import { avatarTop, layoutAvatar, nameplateTop } from '@chibi-town/character-core/layout-logic';
import { defaultOutfit, femaleOutfit, toEquip } from '@chibi-town/character-core/outfit-logic';
import { spritePixels } from '@chibi-town/render-contracts/sprite-pixels';
import { describe, expect, it } from 'vitest';
import { sheet } from '@/assets/asset-catalog';

describe('nameplate clearance', () => {
  it('reserves a fixed top above every wing and hat frame, including breathing poses', () => {
    for (const back of ['wings.angel', 'wings.dragon', 'wings.fire'])
      for (const hat of ['', 'hat.cap', 'hat.crown', 'hat.halo', 'hat.wizard']) {
        const equip = toEquip({ ...femaleOutfit, back, backLevel: '6', hat, hatLevel: '5' });
        const anchor = nameplateTop(items, sheet, equip);
        for (const pose of [0, 1, 2, 3])
          for (const mirror of [false, true])
            for (let time = 0; time < 1200; time += 40) {
              const top = avatarTop(sheet, layoutAvatar(items, sheet, equip, pose, mirror, time));
              expect(anchor).toBeLessThanOrEqual(top);
            }
      }
    const bare = toEquip(femaleOutfit);
    const halo = toEquip({ ...femaleOutfit, hat: 'hat.halo', hatLevel: '5' });
    expect(nameplateTop(items, sheet, halo)).toBeLessThan(nameplateTop(items, sheet, bare));
  });
  it('uses the rendered top, including tall hats, wings and clipped female hair', () => {
    const outfits = [
      defaultOutfit,
      ...Object.values(items)
        .filter((item) => item.slot === 'hair' && item.gender === 'female' && !item.hidden)
        .map((item) => ({ ...femaleOutfit, hair: item.id })),
    ];
    for (const outfit of outfits)
      for (const hat of ['', 'hat.wizard', 'hat.crown', 'hat.halo'])
        for (const pose of [0, 2])
          for (const mirror of [false, true]) {
            const ops = layoutAvatar(
              items,
              sheet,
              toEquip({ ...outfit, hat, hatLevel: '5', back: 'wings.angel', backLevel: '6' }),
              pose,
              mirror,
              400,
            );
            const renderedTop = Math.min(
              ...ops.map((op) => {
                const raster = spritePixels(sheet, op);
                const first = raster.data.findIndex((value, index) => index % 4 === 3 && value > 0);
                return first < 0 ? Infinity : op.y + Math.floor(first / 4 / raster.width);
              }),
            );
            expect(avatarTop(sheet, ops)).toBe(renderedTop);
            expect(avatarTop(sheet, ops) - 6).toBeLessThan(renderedTop);
          }
  });
  it('ignores transparent padding and fully hidden rows', () => {
    const sample = {
      palette: {},
      pieces: { padded: { name: 'padded', width: 3, height: 3, rows: ['...', '.K.', 'KKK'] } },
    };
    expect(avatarTop(sample, [{ piece: 'padded', x: 0, y: -10, flip: false }])).toBe(-9);
    expect(avatarTop(sample, [{ piece: 'padded', x: 0, y: -10, flip: false, clipTop: -8 }])).toBe(-8);
  });
});
