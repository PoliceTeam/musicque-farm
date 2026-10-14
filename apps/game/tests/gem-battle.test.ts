import {
  adjacentGems,
  bestGemMove,
  createGemBattle,
  earnsGemExtraTurn,
  GEM_TYPES,
  gemMatches,
  gemMatchGroups,
  isGemBattle,
  playGemAction,
  validGemMoves,
} from '@chibi-town/arcade-games/gem-battle-logic';
import { expect, it } from 'vitest';

it('generates deterministic stable, playable boards for many seeds', () => {
  for (let seed = 0; seed < 100; seed++) {
    const battle = createGemBattle('test', 0, seed);
    expect(battle).toEqual(createGemBattle('test', 0, seed));
    expect(gemMatches(battle.board)).toEqual([]);
    expect(validGemMoves(battle.board).length).toBeGreaterThan(0);
    expect(isGemBattle(battle)).toBe(true);
  }
});
it('rejects row wrapping, nonmatching swaps and skills without consuming a turn', () => {
  const battle = createGemBattle('test', 0, 42);
  const before = JSON.stringify(battle);
  expect(adjacentGems(7, 8)).toBe(false);
  expect(() => playGemAction(battle, { type: 'swap', from: 7, to: 8 })).toThrow('INVALID_MOVE');
  expect(() => playGemAction(battle, { type: 'skill' })).toThrow('NOT_ENOUGH_MANA');
  const valid = validGemMoves(battle.board);
  let checked = false;
  for (let from = 0; from < 63; from++) {
    const to = from + 1;
    if (adjacentGems(from, to) && !valid.some((move) => move.from === from && move.to === to)) {
      expect(() => playGemAction(battle, { type: 'swap', from, to })).toThrow('NO_MATCH');
      checked = true;
      break;
    }
  }
  expect(checked).toBe(true);
  expect(JSON.stringify(battle)).toBe(before);
});
it('counts intersecting matches once', () => {
  const board = Array.from({ length: 64 }, (_, i) => GEM_TYPES[1 + ((i + Math.floor(i / 8)) % 5)]);
  for (const i of [18, 26, 33, 34, 35]) board[i] = 'attack';
  expect(gemMatches(board)).toEqual([18, 26, 33, 34, 35]);
});
it('spends mana, absorbs damage with shield and ends a battle without a bot response', () => {
  const battle = createGemBattle('test', 0, 42);
  battle.player.mana = 60;
  battle.bot.hp = 100;
  battle.bot.shield = 30;
  const result = playGemAction(battle, { type: 'skill' });
  expect(result.battle.status).toBe('won');
  expect(result.battle.player.mana).toBe(0);
  expect(result.battle.bot).toEqual({ hp: 0, mana: 0, shield: 0 });
  expect(result.steps).toHaveLength(1);
  expect(result.steps[0].damage).toBe(180);
  expect(battle.bot.hp).toBe(100);
  expect(() => playGemAction(result.battle, { type: 'skill' })).toThrow('MATCH_FINISHED');
});
it('resolves cascades and bot turns deterministically while preserving stable playable boards', () => {
  for (let seed = 1; seed <= 10; seed++) {
    let battle = createGemBattle('test', 0, seed);
    for (let turn = 0; turn < 50 && battle.status === 'playing'; turn++) {
      const move = validGemMoves(battle.board)[0];
      const action =
        battle.player.mana >= 60 ? { type: 'skill' as const } : { type: 'swap' as const, from: move.from, to: move.to };
      const result = playGemAction(battle, action);
      expect(result).toEqual(playGemAction(battle, action));
      expect(result.battle.revision).toBe(battle.revision + 1);
      expect(result.battle.score).toBeGreaterThanOrEqual(battle.score);
      expect(result.steps[0].actor).toBe('player');
      expect(isGemBattle(result.battle)).toBe(true);
      expect(gemMatches(result.battle.board)).toEqual([]);
      expect(validGemMoves(result.battle.board).length).toBeGreaterThan(0);
      battle = result.battle;
    }
  }
});

function matchFixture(gem: (typeof GEM_TYPES)[number], size = 3, seed = 42) {
  const battle = createGemBattle('fixture', 0, seed);
  battle.board = Array.from({ length: 64 }, (_, i) => GEM_TYPES[((i % 8) + 2 * Math.floor(i / 8)) % 6]);
  battle.board[0] = battle.board[1] = gem;
  battle.board[2] = gem === 'heal' ? 'mana' : 'heal';
  battle.board[10] = gem;
  battle.board[3] = size === 4 ? gem : gem === 'shield' ? 'heal' : 'shield';
  expect(gemMatches(battle.board)).toEqual([]);
  return battle;
}

it('awards one bonus turn for intersecting runs, not for unrelated triples', () => {
  const board = matchFixture('attack').board;
  for (const i of [18, 26, 33, 34, 35]) board[i] = 'attack';
  expect(earnsGemExtraTurn(board)).toBe(true);
  const separate = Array.from({ length: 64 }, (_, i) => GEM_TYPES[((i % 8) + 2 * Math.floor(i / 8)) % 6]);
  for (const i of [0, 1, 2]) separate[i] = 'attack';
  for (const i of [40, 41, 42]) separate[i] = 'mana';
  expect(gemMatchGroups(separate).map((group) => group.length)).toEqual([3, 3]);
  expect(earnsGemExtraTurn(separate)).toBe(false);
});
it('keeps the player turn after a four-match and applies the same consecutive limit', () => {
  const battle = matchFixture('attack', 4);
  const result = playGemAction(battle, { type: 'swap', from: 2, to: 10 });
  expect(result.extraTurn).toBe(true);
  expect(result.battle.bonusTurns).toBe(1);
  expect(result.steps.every((step) => step.actor === 'player')).toBe(true);
  expect(result.steps.at(-1)?.extraTurn).toBe(true);
  expect(result.steps[0].damage).toBe(180);
  battle.bonusTurns = 3;
  const capped = playGemAction(battle, { type: 'swap', from: 2, to: 10 });
  expect(capped.extraTurn).toBe(false);
  expect(capped.battle.bonusTurns).toBe(0);
  expect(capped.steps.some((step) => step.actor === 'bot')).toBe(true);
});
it('gives purple distinct deterministic rewards and doubles points for a yellow match', () => {
  const rewards = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const battle = matchFixture('luck', 3, seed);
    battle.player.hp = 500;
    const result = playGemAction(battle, { type: 'swap', from: 2, to: 10 });
    expect(result).toEqual(playGemAction(battle, { type: 'swap', from: 2, to: 10 }));
    const step = result.steps[0];
    rewards.add(step.luckReward!);
    expect(step.player.hp).toBe(step.luckReward === 'heal' ? 572 : 500);
    expect(step.player.mana).toBe(step.luckReward === 'mana' ? 36 : 0);
    expect(step.player.shield).toBe(step.luckReward === 'shield' ? 54 : 0);
  }
  expect([...rewards].sort()).toEqual(['heal', 'mana', 'shield']);
  const yellow = playGemAction(matchFixture('score'), { type: 'swap', from: 2, to: 10 });
  expect(yellow.steps[0].score).toBe(60);
  expect(yellow.steps[0].damage).toBe(0);
});
it('spells end bonus streaks, and the bot evaluates visible post-swap colors', () => {
  const battle = createGemBattle('test', 0, 0);
  battle.player.mana = 60;
  battle.bonusTurns = 2;
  const result = playGemAction(battle, { type: 'skill' });
  expect(result.extraTurn).toBe(false);
  expect(result.battle.bonusTurns).toBe(0);
  expect(result.steps.some((step) => step.actor === 'bot')).toBe(true);
  const alteredSeed = { ...battle, seed: 123456 };
  expect(bestGemMove(battle, 'bot')).toEqual(bestGemMove(alteredSeed, 'bot'));
  const move = bestGemMove(battle, 'bot')!;
  const board = [...battle.board];
  [board[move.from], board[move.to]] = [board[move.to], board[move.from]];
  expect(move.matched).toEqual(gemMatches(board));
});
it('bot bonus turns and cascades provide accurate replay boards and bounded steps', () => {
  let sawBotBonus = false;
  for (let seed = 0; seed < 80; seed++) {
    const battle = createGemBattle('test', 0, seed);
    const move = validGemMoves(battle.board)[0];
    const result = playGemAction(battle, { type: 'swap', from: move.from, to: move.to });
    sawBotBonus ||= result.steps.some((step) => step.actor === 'bot' && step.extraTurn);
    expect(result.steps.length).toBeLessThanOrEqual(160);
    expect(result.steps.filter((step) => step.actor === 'bot' && step.combo === 1).length).toBeLessThanOrEqual(4);
    for (const step of result.steps) {
      if (step.beforeBoard) expect(gemMatches(step.beforeBoard)).toEqual(step.cleared);
      if (step.reshuffled) expect(result.reshuffled).toBe(true);
    }
  }
  expect(sawBotBonus).toBe(true);
});
