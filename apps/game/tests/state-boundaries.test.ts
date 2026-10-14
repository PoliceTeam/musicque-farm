import { Action } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { defaultOutfit, gokuOutfit, normalizeOutfitLevels } from '@chibi-town/character-core/outfit-logic';
import { describe, expect, it } from 'vitest';
import { createTownState, moveTownTo, setTownOutfit, updateTown } from '@/devtools/town/_utils/town-logic';
import { WALK_AREA } from '@/devtools/town/_utils/town-map';
import {
  createCharacterLabState,
  equippedHat,
  flipCharacterLab,
  setCharacterLabOutfit,
  tickCharacterLab,
  updateCharacterLab,
} from '@/features/character/_utils/character-lab-logic';

// These run in Node: state and equipment must work without a browser or Phaser.
describe('state across the new module boundaries', () => {
  it('creates independent simulation state for each Lab and town instance', () => {
    const first = createCharacterLabState();
    const second = createCharacterLabState();
    setCharacterLabOutfit(first, { ...gokuOutfit, pet: 'cat' });
    first.heroWalking = true;
    updateCharacterLab(first, 0.05);
    expect(second.outfit).toEqual(defaultOutfit);
    expect(second.hero.tick).toBe(0);
    expect(second.residents[0].pet).toBeUndefined();
    expect(first.hero).not.toBe(second.hero);
    const town = createTownState({ ...defaultOutfit });
    const other = createTownState({ ...defaultOutfit });
    moveTownTo(town, 200, 200);
    expect(other.marker).toBeNull();
    expect(other.player.target).toBeNull();
  });
  it('keeps user choices and clamps unsupported levels after a family change', () => {
    const original = { ...gokuOutfit, hair: 'hair.mop', hairLevel: '4', hat: 'hat.cap', hatLevel: '5' };
    const next = normalizeOutfitLevels(original);
    expect(next.hairLevel).toBe('1');
    expect(next.hatLevel).toBe('3');
    expect(next.shirt).toBe(original.shirt);
    expect(original.hairLevel).toBe('4');
  });
  it('equips the selected upgrade, clears old hat particles and adds/removes pets in the lab', () => {
    const lab = createCharacterLabState();
    setCharacterLabOutfit(lab, { ...gokuOutfit, hairLevel: '4', hat: 'hat.wizard', hatLevel: '5', pet: 'cat' });
    expect(lab.hero.equip.some((e) => e.item === 'hair.goku.4')).toBe(true);
    updateCharacterLab(lab, 0.1);
    expect(equippedHat(lab.hero)?.hat.effect).toBeDefined();
    expect(lab.residents[0].pet).toBeDefined();
    setCharacterLabOutfit(lab, { ...defaultOutfit });
    expect(equippedHat(lab.hero)).toBeUndefined();
    expect(lab.residents[0].pet).toBeUndefined();
  });
  it('keeps flip, walking and fixed animation ticks independent of rendering', () => {
    const lab = createCharacterLabState();
    flipCharacterLab(lab);
    expect(lab.hero.mirror).toBe(true);
    const x = lab.residents[0].x;
    lab.heroWalking = true;
    tickCharacterLab(lab);
    updateCharacterLab(lab, 0.09);
    expect(lab.residents[0].x).toBeLessThan(x);
    expect(lab.hero.action).toBe(Action.Walk);
    lab.heroWalking = false;
    updateCharacterLab(lab, 0.09);
    expect(lab.hero.action).toBe(Action.Stand);
  });
  it('clamps pointer targets and keyboard movement clears the click marker in town', () => {
    const town = createTownState({ ...defaultOutfit });
    moveTownTo(town, -100, 1000);
    expect(town.player.target).toEqual([WALK_AREA.x0, WALK_AREA.y1]);
    const x = town.player.x;
    updateTown(town, 0.05, [1, 0]);
    expect(town.player.x).toBeGreaterThan(x);
    expect(town.player.target).toBeNull();
    expect(town.marker).toBeNull();
  });
  it('rebuilds town equipment and evolved pet effects from the same outfit rules', () => {
    const town = createTownState({ ...defaultOutfit });
    setTownOutfit(town, { ...gokuOutfit, hat: 'hat.crown', hatLevel: '5', pet: 'cat', petLevel: '3' });
    expect(town.player.avatar.equip.some((e) => items[e.item]?.id === 'hat.crown.5')).toBe(true);
    expect(town.player.pet?.def.level).toBe(3);
    expect(town.player.fx?.hat).toBeDefined();
    setTownOutfit(town, { ...defaultOutfit });
    expect(town.player.pet).toBeUndefined();
    expect(town.player.fx?.hat).toBeUndefined();
  });
});
