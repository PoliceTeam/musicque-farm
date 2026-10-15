import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { CharacterRenderer, RendererOptions } from '@chibi-town/render-contracts/renderer-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTownGame } from '@/devtools/town/runtime/town-game';

const fixture = vi.hoisted(() => ({
  options: undefined as RendererOptions | undefined,
  direction: [1, 0] as [number, number],
  draw: vi.fn(),
  destroy: vi.fn(),
  setActive: vi.fn(),
  load: vi.fn(),
}));
vi.mock('@/game/rendering/renderer-providers', () => ({
  createPreviewProviders: async (name: string) => {
    fixture.load(name);
    return {
      create: (_name: string, options: RendererOptions) => {
        fixture.options = options;
        return {
          kind: 'phaser-webgl',
          destroy: fixture.destroy,
          setActive: fixture.setActive,
        } as unknown as CharacterRenderer;
      },
    };
  },
}));
vi.mock('@/game/rendering/town-view', () => ({
  TownView: class {
    pieces = {};
    draw = fixture.draw;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.direction = [1, 0];
});

function host() {
  return { dataset: {} } as HTMLElement;
}

describe('Phaser town lifecycle', () => {
  it('uses scene frames for movement, pauses cleanly and releases input and renderer', async () => {
    const parent = host();
    const game = await createTownGame(parent, { ...defaultOutfit });
    const options = fixture.options!;
    const renderer = { kind: 'phaser-webgl' } as CharacterRenderer;
    expect(fixture.load).toHaveBeenCalledWith('phaser');
    options.onReady?.(renderer);
    expect(parent.dataset.renderer).toBe('phaser-webgl');
    expect(options.fillParent).toBe(true);
    expect(options.camera?.worldWidth).toBe(1280);
    expect(options.camera?.worldHeight).toBe(720);
    expect(options.camera?.zoom).toBe(2);
    expect(options.camera?.target()).toEqual([game.player.x, game.player.y]);
    expect(fixture.setActive).toHaveBeenLastCalledWith(false);
    const x = game.player.x;
    options.onFrame(renderer, 0, 16);
    expect(game.player.x).toBe(x);
    const stop = game.start();
    options.onFrame(renderer, 90, 90, { direction: fixture.direction });
    expect(game.player.x).toBeCloseTo(x + game.player.speed * 0.05);
    expect(fixture.draw).toHaveBeenCalledWith(renderer, 90);
    expect(options.fixedStep!.interval).toBe(90);
    const tick = game.player.avatar.tick;
    options.fixedStep!.onTick();
    expect(game.player.avatar.tick).toBe((tick + 1) % 10);
    stop();
    const paused = game.player.x;
    options.onFrame(renderer, 180, 90);
    expect(game.player.x).toBe(paused);
    expect(fixture.draw).toHaveBeenCalledTimes(1);
    game.destroy();
    expect(fixture.destroy).toHaveBeenCalledOnce();
    expect(fixture.setActive.mock.calls).toEqual([[false], [true], [false]]);
  });

  it('accepts native pointer commands from Phaser, ignores paused input and keeps outfits live', async () => {
    const parent = host();
    const game = await createTownGame(parent, { ...defaultOutfit });
    fixture.options!.input!.onPointerDown(200, 200);
    expect(game.player.target).toBeNull();
    game.start();
    fixture.options!.input!.onPointerDown(200, 200);
    expect(game.player.target).toEqual([200, 200]);
    game.setOutfit({ ...defaultOutfit, hat: 'hat.wizard', hatLevel: '5', pet: 'cat' });
    expect(game.player.avatar.equip.some((e) => e.item === 'hat.wizard.5')).toBe(true);
    expect(game.player.pet).toBeDefined();
    game.destroy();
  });
});
