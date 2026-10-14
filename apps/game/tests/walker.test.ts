import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import { describe, expect, it } from 'vitest';
import { type Area, stepWalker, type Walker } from '@/game/movement/movement-logic';

const area: Area = { x0: 0, x1: 100, y0: 0, y1: 100 };

const walker = (extra: Partial<Walker> = {}): Walker => ({
  name: 'w',
  level: 1,
  x: 50,
  y: 50,
  speed: 10,
  target: null,
  wait: 0,
  avatar: new AvatarState([]),
  player: true,
  ...extra,
});

describe('stepWalker', () => {
  it('faces the way it walks horizontally', () => {
    const w = walker();
    stepWalker(w, 0.1, area, [-1, 0]);
    expect(w.avatar.mirror).toBe(true);
    expect(w.avatar.action).toBe(Action.Walk);
    stepWalker(w, 0.1, area, [1, 0]);
    expect(w.avatar.mirror).toBe(false);
  });

  it('keeps its facing when walking straight up or down (like hn.g)', () => {
    const w = walker();
    stepWalker(w, 0.1, area, [-1, 0]);
    stepWalker(w, 0.1, area, [0, 1]);
    stepWalker(w, 0.1, area, [0, -1]);
    expect(w.avatar.mirror).toBe(true);
  });

  it('reaches a click target without overshooting, then stands', () => {
    const w = walker({ target: [53, 50] });
    let arrived = false;
    for (let i = 0; i < 10 && !arrived; i++) arrived = stepWalker(w, 0.1, area);
    expect(arrived).toBe(true);
    expect([w.x, w.y]).toEqual([53, 50]);
    stepWalker(w, 0.1, area);
    expect(w.avatar.action).toBe(Action.Stand);
  });

  it('stays inside the walk area', () => {
    const w = walker({ x: 1, y: 1 });
    for (let i = 0; i < 20; i++) stepWalker(w, 0.5, area, [-1, -1]);
    expect([w.x, w.y]).toEqual([0, 0]);
  });

  it('keys override a click target', () => {
    const w = walker({ target: [90, 50] });
    stepWalker(w, 0.1, area, [-1, 0]);
    expect(w.target).toBeNull();
    expect(w.x).toBeLessThan(50);
  });

  it('lets NPCs idle, then pick a target inside the area', () => {
    const w = walker({ player: false, wait: 0.05 });
    stepWalker(w, 0.1, area, [0, 0], () => 0.99);
    expect(w.target).not.toBeNull();
    const [tx, ty] = w.target!;
    expect(tx).toBeGreaterThanOrEqual(0);
    expect(tx).toBeLessThanOrEqual(100);
    expect(ty).toBeGreaterThanOrEqual(0);
    expect(ty).toBeLessThanOrEqual(100);
  });
});
