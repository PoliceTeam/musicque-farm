import { items, pets } from '@chibi-town/character-core/item-catalog';
import { describe, expect, it } from 'vitest';
import { sheet } from '@/assets/asset-catalog';
import { hatAreas, hatLights, isEffect, mirrorArea, STYLES, strongest } from '@/features/character/_utils/effect-logic';

describe('particle effects', () => {
  it('attached hat lights animate, follow every pose and mirror above the face', () => {
    for (const hat of Object.values(items).filter((i) => /^hat\.(wizard|crown|halo)\.[45](\.w\d)?$/.test(i.id))) {
      const frames: string[] = [];
      for (let now = 0; now < 4800; now += 100) {
        const { piece, dx, dy } = hat.poses[0];
        const { width, height } = sheet.pieces[piece];
        const right = hatLights(hat.id, dx, dy, width, height, false, now);
        frames.push(JSON.stringify(right));
        expect(hatLights(hat.id, dx, dy, width, height, true, now)).toEqual(right.map((p) => ({ ...p, x: -p.x - 1 })));
        for (const pose of [1, 2, 3]) {
          const next = hat.poses[pose];
          expect(hatLights(hat.id, next.dx, next.dy, width, height, false, now)).toEqual(
            right.map((p) => ({ ...p, x: p.x + next.dx - dx, y: p.y + next.dy - dy })),
          );
        }
        for (const p of right) expect(p.y + 1).toBeLessThan(items['eyes.big'].poses[0].dy);
        expect(right.length).toBeLessThanOrEqual(10);
      }
      expect(new Set(frames).size).toBeGreaterThan(1);
    }
    expect(hatLights('hat.crown.3', -22, -88, 40, 28, false, 500)).toEqual([]);
    expect(hatLights('hat.beanie.3', -26, -76, 48, 33, false, 500)).toEqual([]);
  });
  it('upgraded hat sparkles stay above the eyes for all widths, poses and facings', () => {
    for (const hat of Object.values(items).filter((i) => i.slot === 'hat')) {
      expect(isEffect(hat.effect)).toBe(/\.[3-5](\.female)?(\.w\d)?$/.test(hat.id));
      if (hat.id.startsWith('hat.cap.3')) expect(hat.effect).toBe('crystal');
      if (!isEffect(hat.effect)) continue;
      for (const pose of [0, 1, 2, 3])
        for (const mirror of [false, true]) {
          const { piece, dx, dy } = hat.poses[pose];
          const { width, height } = sheet.pieces[piece];
          const areas = hatAreas(dx, dy, width, height, mirror);
          for (const area of areas)
            expect(area.y1 + STYLES[hat.effect].size[1]).toBeLessThan(items['eyes.big'].poses[pose].dy);
          expect(STYLES[hat.effect].rate).toEqual([6, 10]);
        }
    }
  });
  it('mirrors the spawn area with the facing', () => {
    expect(mirrorArea({ x0: -34, x1: 30, y0: -1, y1: 0 }, true)).toEqual({ x0: -30, x1: 34, y0: -1, y1: 0 });
  });

  it('picks the highest aura and its effect', () => {
    expect(strongest([{ aura: 1 }, { effect: 'snow', aura: 3 }, { effect: 'embers' }])).toEqual({
      effect: 'snow',
      aura: 3,
    });
    expect(strongest([{}])).toEqual({ aura: 0 });
  });

  it('top wings and Lv.3 pets carry valid effects and auras; lower ranks stay plain', () => {
    for (const item of Object.values(items).filter((i) => i.family?.startsWith('wings.'))) {
      expect(item.aura ?? 0, item.id).toBe(Math.max(0, item.level! - 3));
      expect(isEffect(item.effect), item.id).toBe(item.level! >= 5);
    }
    for (const pet of Object.values(pets)) {
      expect(isEffect(pet.effect), pet.id).toBe(pet.level === 3);
      if (pet.effect) expect(Object.keys(STYLES)).toContain(pet.effect);
    }
  });
});
