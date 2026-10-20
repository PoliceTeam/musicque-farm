import { pets } from '@chibi-town/character-core/item-catalog';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { expect, it } from 'vitest';
import { characterPreviewLayout } from '@/features/character/_utils/character-preview-layout';

it('keeps all three dragon levels clear of Goku hair and inside the preview', () => {
  for (const level of ['1', '2', '3']) {
    const model = characterPreviewLayout({
      ...defaultOutfit,
      hair: 'hair.goku',
      hairLevel: '4',
      pet: 'dragon',
      petLevel: level,
    });
    const pet = model.pet!;
    expect(pet.definition.level).toBe(Number(level));
    expect(pet.x + (pet.width * pet.scale) / 2).toBeLessThanOrEqual(model.avatar.left - 6 + 1e-8);
    const { x, y, scale } = model.camera;
    expect(x + (pet.x - (pet.width * pet.scale) / 2) * scale).toBeGreaterThanOrEqual(11.99);
    expect(y + (pet.y - pet.height * pet.scale) * scale).toBeGreaterThanOrEqual(11.99);
    expect(x + (model.avatar.left + model.avatar.width) * scale).toBeLessThanOrEqual(308.01);
    expect(y + (model.avatar.top + model.avatar.height) * scale).toBeLessThanOrEqual(308.01);
  }
});

it('fits every companion level with large hair and retains the original camera without a pet', () => {
  expect(characterPreviewLayout({ ...defaultOutfit, pet: '' }).camera).toEqual({ x: 160, y: 240, scale: 2.4 });
  for (const pet of Object.values(pets)) {
    const model = characterPreviewLayout({
      ...defaultOutfit,
      hair: 'hair.goku',
      hairLevel: '4',
      pet: pet.family ?? pet.id,
      petLevel: String(pet.level ?? 1),
    });
    const p = model.pet!;
    expect(p.x + (p.width * p.scale) / 2).toBeLessThanOrEqual(model.avatar.left - 6 + 1e-8);
    expect(model.camera.x + (p.x - (p.width * p.scale) / 2) * model.camera.scale).toBeGreaterThanOrEqual(11.99);
    expect(model.camera.y + (p.y - p.height * p.scale) * model.camera.scale).toBeGreaterThanOrEqual(11.99);
  }
});
