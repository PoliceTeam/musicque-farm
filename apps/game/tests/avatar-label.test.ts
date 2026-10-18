import { AvatarState } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { avatarTop, layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { defaultOutfit, toEquip } from '@chibi-town/character-core/outfit-logic';
import { type CharacterRenderer, MAP_LABEL_STYLE } from '@chibi-town/render-contracts/renderer-types';
import { expect, it, vi } from 'vitest';
import { sheet } from '@/assets/asset-catalog';
import { drawAvatarLabel } from '@/game/rendering/avatar-label';

it('keeps the player name yellow and clear of the rendered head and tall hats at either map scale', () => {
  for (const hat of ['', 'hat.wizard', 'hat.halo'])
    for (const scale of [0.85, 1]) {
      const avatar = new AvatarState(toEquip({ ...defaultOutfit, hat, hatLevel: '5' }));
      const label = vi.fn();
      drawAvatarLabel({ label } as unknown as CharacterRenderer, 'LV 1 Bé Chibi', avatar, 400, 500, scale, true);
      const [text, x, y, color] = label.mock.calls[0];
      expect(text).toBe('LV 1 Bé Chibi');
      expect(x).toBe(400);
      expect(color).toBe('#ffe066');
      expect(label.mock.calls[0][5]).toBe(MAP_LABEL_STYLE.fontSize);
      for (const pose of [0, 1, 2, 3])
        for (const time of [0, 200, 400, 600]) {
          const head = avatarTop(sheet, layoutAvatar(items, sheet, avatar.equip, pose, false, time));
          expect(y).toBeLessThanOrEqual(500 + head * scale - 14);
        }
    }
});

it('preserves the white label on NPCs and remote residents', () => {
  const avatar = new AvatarState(toEquip(defaultOutfit));
  const label = vi.fn();
  drawAvatarLabel({ label } as unknown as CharacterRenderer, 'NPC', avatar, 0, 100, 1);
  expect(label.mock.calls[0][3]).toBe('#ffffff');
});
