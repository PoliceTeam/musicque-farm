import type { CharacterGender } from '@chibi-town/character-core/character-types';
import { itemAvailableForGender } from '@chibi-town/character-core/item-catalog';
import {
  defaultOutfit,
  femaleOutfit,
  fieldOptions,
  outfitFields,
  randomOutfit,
  sanitizeOutfit,
  toEquip,
} from '@chibi-town/character-core/outfit-logic';
import { seededRandom } from '@chibi-town/character-core/random';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { RegistrationCharacter } from '@/features/auth/_components/registration-character';
import { createCharacterLabState, setCharacterLabOutfit } from '@/features/character/_utils/character-lab-logic';

const hairField = outfitFields.find((f) => f.key === 'hair')!;
describe('gender-specific wardrobe and Lab', () => {
  it('keeps private items out of the other tab while offering shared items in both', () => {
    expect(fieldOptions(hairField, femaleOutfit).map(([id]) => id)).toEqual([
      '',
      'hair.female-long',
      'hair.female-short',
      'hair.female-shoulder',
      'hair.female-ponytail',
      'hair.female-twintails',
      'hair.female-double-buns',
      'hair.female-half-up',
      'hair.female-low-bun',
      'hair.female-low-ponytail',
    ]);
    expect(fieldOptions(hairField, defaultOutfit).map(([id]) => id)).not.toContain('hair.female-long');
    for (const outfit of [defaultOutfit, femaleOutfit]) {
      const hatField = outfitFields.find((f) => f.key === 'hat')!;
      expect(fieldOptions(hatField, outfit).map(([id]) => id)).toContain('hat.crown');
    }
    const shirtField = outfitFields.find((f) => f.key === 'shirt')!;
    expect(fieldOptions(shirtField, femaleOutfit).map(([id]) => id)).not.toContain('shirt.goku');
  });

  it('filters random selection and equipment at the core boundary', () => {
    for (const gender of ['male', 'female'] as CharacterGender[])
      for (let seed = 1; seed <= 50; seed++) {
        const outfit = randomOutfit(seededRandom(seed), gender);
        expect(outfit.gender).toBe(gender);
        for (const { item } of toEquip(outfit)) expect(itemAvailableForGender(item, gender), item).toBe(true);
      }
    expect(toEquip({ ...femaleOutfit, shirt: 'shirt.goku' }).map((e) => e.item)).not.toContain('shirt.goku');
  });

  it('repairs cross-tab saved choices and migrates saves without gender', () => {
    expect(sanitizeOutfit({ ...femaleOutfit, hair: 'hair.goku', shirt: 'shirt.goku' }).hair).toBe(femaleOutfit.hair);
    const { gender: _gender, ...legacyFemale } = femaleOutfit;
    expect(sanitizeOutfit(legacyFemale)).toEqual(femaleOutfit);
    const { gender: _maleGender, ...legacyMale } = defaultOutfit;
    expect(sanitizeOutfit(legacyMale)).toEqual(defaultOutfit);
  });

  it('changes the Lab comparison residents to the active gender', () => {
    const state = createCharacterLabState();
    setCharacterLabOutfit(state, femaleOutfit);
    for (const resident of state.residents)
      for (const { item } of resident.avatar.equip) expect(itemAvailableForGender(item, 'female'), item).toBe(true);
    setCharacterLabOutfit(state, defaultOutfit);
    for (const resident of state.residents)
      for (const { item } of resident.avatar.equip) expect(itemAvailableForGender(item, 'male'), item).toBe(true);
  });

  it('renders the current React gender controls with the matching selected hair', () => {
    const render = (outfit: typeof defaultOutfit) =>
      renderToStaticMarkup(
        createElement(
          I18nextProvider,
          { i18n: createGameI18n() },
          createElement(RegistrationCharacter, {
            outfit,
            disabled: false,

            onChange() {},
          }),
        ),
      );

    const female = render(femaleOutfit);
    const male = render(defaultOutfit);
    expect(female).toMatch(/aria-selected="true"[^>]*>Nữ<\/button>/);
    expect(female).toContain('Tóc nữ dài');
    expect(female).not.toContain('Tóc bồng');
    expect(male).toMatch(/aria-selected="true"[^>]*>Nam<\/button>/);
    expect(male).toContain('Tóc bồng');
    expect(male).not.toContain('Tóc nữ dài');
  });
});
