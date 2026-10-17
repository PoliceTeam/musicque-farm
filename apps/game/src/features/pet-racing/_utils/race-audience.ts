import { defaultOutfit, femaleOutfit, randomOutfit } from '@chibi-town/character-core/outfit-logic';

/** Choose once per visit from the real catalog; spectators do not carry pets or obscure other seats. */
export function createRaceAudience(random: () => number = Math.random) {
  return Array.from({ length: 7 }, (_, index) => {
    const gender = index % 2 ? 'female' : 'male';
    const base = gender === 'female' ? femaleOutfit : defaultOutfit;
    const outfit = randomOutfit(random, gender);
    return {
      outfit: {
        ...outfit,
        hair: outfit.hair || base.hair,
        shirt: outfit.shirt || base.shirt,
        shoes: outfit.shoes || base.shoes,
        back: '',
        held: '',
        tail: '',
        pet: '',
        mouthAcc: '',
        sticker: '',
      },
    };
  });
}
