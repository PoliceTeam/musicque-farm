import { items } from '@chibi-town/character-core/item-catalog';
import { nameplateTop } from '@chibi-town/character-core/layout-logic';
import { femaleOutfit } from '@chibi-town/character-core/outfit-logic';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { describe, expect, it, vi } from 'vitest';
import { sheet } from '@/assets/asset-catalog';
import { createTownState } from '@/devtools/town/_utils/town-logic';
import { TownView } from '@/devtools/town/rendering/town-view';

vi.mock('@/features/farm/rendering/farm-view', () => ({
  Farm: class {
    surfaces() {
      return [{ key: 'ground', source: {}, x: 0, y: 0, width: 1280, height: 720, depth: -1 }];
    }
  },
}));

describe('independent town character size', () => {
  it('keeps ground dimensions and feet fixed while scaling all equipment and name clearance', () => {
    for (const hat of ['', 'hat.beanie', 'hat.crown', 'hat.halo']) {
      const state = createTownState({ ...femaleOutfit, hat });
      state.residents = [state.player];
      const calls = {
        kind: 'test',
        beginFrame: vi.fn(),
        endFrame: vi.fn(),
        surface: vi.fn(),
        drawPieces: vi.fn(),
        rectangle: vi.fn(),
        aura: vi.fn(),
        particles: vi.fn(),
        label: vi.fn(),
        marker: vi.fn(),
        resize: vi.fn(),
        setActive: vi.fn(),
        destroy: vi.fn(),
      } satisfies CharacterRenderer;
      const view = new TownView(state);
      for (const mirror of [false, true]) {
        state.player.avatar.mirror = mirror;
        view.draw(calls, 0);
        expect(calls.surface).toHaveBeenLastCalledWith('ground', {}, 0, 0, 1280, 720);
        const [, , ops, x, y, scale] = calls.drawPieces.mock.calls.at(-1)!;
        expect(ops.length).toBeGreaterThan(0);
        expect([x, y, scale]).toEqual([state.player.x, state.player.y, 0.75]);
        const top = nameplateTop(items, sheet, state.player.avatar.equip);
        expect(calls.label.mock.calls.at(-1)![2]).toBe(state.player.y + top * 0.75 - 14);
      }
    }
  });
});
