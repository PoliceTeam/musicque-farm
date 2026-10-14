/**
 * Simulation audit of Kim cương (match-3 duel): engine, bot, payouts through the local SDK.
 *
 * Every cascade step is recomputed by an independent reference written from `docs/arcade.md` and `DIAMOND_RULES`.
 * Sample sizes are small by default; the exploratory audit ran with `AUDIT_GAMES=2000 AUDIT_REPORT=1`
 * (per difficulty × policy). `it.fails` marks a reproduced defect: it flips to a failure once the defect is fixed.
 */
import { createLocalDocument, createLocalSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import {
  bestGemMove,
  createGemBattle,
  GEM_TYPES,
  type Gem,
  type GemAction,
  type GemBattle,
  type GemFighter,
  type GemResult,
  isGemBattle,
  playGemAction,
  validGemMoves,
} from '@chibi-town/arcade-games/gem-battle-logic';
import type { ArcadeDifficulty } from '@chibi-town/arcade-games/session';
import { decodeGemBattle, decodeGemResult } from '@chibi-town/contracts/arcade';
import { DIAMOND_RULES } from '@chibi-town/game-content/arcade-catalog';
import { describe, expect, it } from 'vitest';

const GAMES = Number(process.env.AUDIT_GAMES ?? 60);
const REPORT = !!process.env.AUDIT_REPORT;
const ONLY = process.env.AUDIT_ONLY;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const R = DIAMOND_RULES;

const report = (...rows: unknown[]) => {
  if (REPORT) console.log(...rows);
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

/** Independent match finder: maximal row/column runs of three or more, merged when they share a cell. */
function refGroups(board: readonly Gem[]) {
  const runs: number[][] = [];
  for (let line = 0; line < 8; line++)
    for (const horizontal of [true, false]) {
      let start = 0;
      for (let i = 1; i <= 8; i++) {
        const at = (k: number) => (horizontal ? line * 8 + k : k * 8 + line);

        if (i === 8 || board[at(i)] !== board[at(start)]) {
          if (i - start >= 3) runs.push(Array.from({ length: i - start }, (_, k) => at(start + k)));
          start = i;
        }
      }
    }
  const parent = runs.map((_, i) => i);

  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };

  for (let a = 0; a < runs.length; a++)
    for (let b = a + 1; b < runs.length; b++)
      if (runs[a].some((cell) => runs[b].includes(cell))) parent[find(a)] = find(b);
  const groups = new Map<number, Set<number>>();
  runs.forEach((run, i) => {
    const group = groups.get(find(i)) ?? new Set<number>();
    for (const cell of run) group.add(cell);
    groups.set(find(i), group);
  });
  return [...groups.values()].map((group) => [...group].sort((a, b) => a - b));
}

const refCleared = (board: readonly Gem[]) =>
  refGroups(board)
    .flat()
    .sort((a, b) => a - b);

function refMoves(board: readonly Gem[]) {
  const moves: [number, number][] = [];
  for (let i = 0; i < 64; i++)
    for (const j of [i + 1, i + 8]) {
      if (j > 63 || (j === i + 1 && i % 8 === 7)) continue;
      const swapped = [...board];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      if (refGroups(swapped).length) moves.push([i, j]);
    }
  return moves;
}

const adjacent = (a: number, b: number) =>
  Math.abs(a - b) === 8 || (Math.abs(a - b) === 1 && Math.floor(a / 8) === Math.floor(b / 8));

function swapBetween(before: readonly Gem[], after: readonly Gem[]) {
  const changed = before.flatMap((gem, i) => (gem === after[i] ? [] : [i]));
  if (changed.length !== 2 || !adjacent(changed[0], changed[1])) return;
  return before[changed[0]] === after[changed[1]] && before[changed[1]] === after[changed[0]] ? changed : undefined;
}

type Policy = 'random' | 'hint' | 'heuristic' | 'mirror' | 'seed-oracle';

function botLikeAction(battle: GemBattle, side: 'player' | 'bot', difficulty: ArcadeDifficulty, random: () => number) {
  const me = battle[side],
    foe = battle[side === 'player' ? 'bot' : 'player'];
  const hardMove = difficulty === 'hard' ? bestGemMove(battle, side, 'hard') : undefined;
  if (me.mana >= R.skillCost && (!hardMove || foe.hp + foe.shield <= R.skillDamage || hardMove.value < R.skillDamage))
    return { type: 'skill' } as const;
  if (difficulty === 'easy') {
    const moves = validGemMoves(battle.board);
    return moves[Math.floor(random() * moves.length)];
  }
  return bestGemMove(battle, side, difficulty);
}

function choose(battle: GemBattle, policy: Policy, difficulty: ArcadeDifficulty, random: () => number): GemAction {
  const moves = validGemMoves(battle.board);

  const swap = (move: { from: number; to: number }): GemAction => ({ type: 'swap', from: move.from, to: move.to });

  if (policy === 'random') {
    if (battle.player.mana >= R.skillCost && random() < 0.5) return { type: 'skill' };
    return swap(moves[Math.floor(random() * moves.length)]);
  }
  if (policy === 'hint') return battle.player.mana >= R.skillCost ? { type: 'skill' } : swap(moves[0]);
  if (policy === 'seed-oracle') {
    // Uses only what the SDK returns to the client (which includes the RNG seed): try every action, keep the best outcome.
    let best: { action: GemAction; value: number } | undefined;
    const actions: GemAction[] = moves.map(swap);
    if (battle.player.mana >= R.skillCost) actions.push({ type: 'skill' });
    for (const action of actions) {
      const next = playGemAction(battle, action).battle;
      const value =
        next.status === 'won'
          ? 1e6
          : next.status === 'lost'
            ? -1e6
            : next.player.hp + next.player.shield + next.player.mana - (next.bot.hp + next.bot.shield + next.bot.mana);
      if (!best || value > best.value) best = { action, value };
    }
    return best!.action;
  }
  const picked = botLikeAction(battle, 'player', policy === 'heuristic' ? 'hard' : difficulty, random);
  return 'type' in picked ? picked : swap(picked);
}

type Stat = {
  games: number;
  wins: number;
  requests: number;
  maxRequests: number;
  steps: number;
  reshuffles: number;
  botMoves: number;
  ms: number;
  maxMs: number;
  maxCombo: number;
  maxBotRun: number;
  maxPlayerRun: number;
  maxSteps: number;
  score: number;
  times: number[];
};

/** Percentile of per-request engine time; robust against scheduler stalls on a loaded machine. */
const pct = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;

const newStat = (): Stat => ({
  games: 0,
  wins: 0,
  requests: 0,
  maxRequests: 0,
  steps: 0,
  reshuffles: 0,
  botMoves: 0,
  ms: 0,
  maxMs: 0,
  maxCombo: 0,
  maxBotRun: 0,
  maxPlayerRun: 0,
  maxSteps: 0,
  score: 0,
  times: [],
});

const RESULT_KEYS = new Set([
  'battle',
  'steps',
  'reshuffled',
  'extraTurn',
  'id',
  'roomId',
  'tableId',
  'session',
  'board',
  'player',
  'bot',
  'status',
  'moves',
  'score',
  'revision',
  'bonusTurns',
  'hp',
  'mana',
  'shield',
  'actor',
  'cleared',
  'damage',
  'healed',
  'combo',
  'beforeBoard',
  'luckReward',
  'hostId',
  'mode',
  'stake',
  'difficulty',
  'configured',
  'settled',
  'coinDelta',
  'members',
  'ready',
]);

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) for (const entry of value) collectKeys(entry, keys);
  else if (value && typeof value === 'object')
    for (const [key, entry] of Object.entries(value)) {
      keys.add(key);
      collectKeys(entry, keys);
    }
  return keys;
}

/** Verifies one request result against the reference; returns the list of rule violations. */
function verifyResult(source: GemBattle, action: GemAction, result: GemResult, stat?: Stat) {
  const issues: string[] = [];

  const fail = (message: string) => issues.push(message);

  const fighters: Record<'player' | 'bot', GemFighter> = { player: { ...source.player }, bot: { ...source.bot } };
  let board = [...source.board];
  let score = source.score;
  let status: GemBattle['status'] = 'playing';
  type Move = { actor: 'player' | 'bot'; skill: boolean; big: boolean; lastStep: number };
  const moves: Move[] = [];
  let combo = 0;
  result.steps.forEach((step, index) => {
    if (status !== 'playing') fail('step after the battle ended');
    const owner = fighters[step.actor],
      foe = fighters[step.actor === 'player' ? 'bot' : 'player'];
    if (step.combo === 0) {
      // special attack
      if (owner.mana < R.skillCost) fail('skill used without enough mana');
      owner.mana -= R.skillCost;
      const blocked = Math.min(foe.shield, R.skillDamage);
      foe.shield -= blocked;
      foe.hp = Math.max(0, foe.hp - (R.skillDamage - blocked));
      if (step.damage !== R.skillDamage - blocked) fail('skill damage differs from 210 minus shield');
      if (step.cleared.length || step.healed) fail('skill cleared gems or healed');
      if (!step.reshuffled && step.board.join() !== board.join()) fail('skill changed the board');
      moves.push({ actor: step.actor, skill: true, big: false, lastStep: index });
      combo = 0;
    } else {
      if (!step.beforeBoard) {
        fail('cascade step without beforeBoard');
        return;
      }
      if (step.combo === 1) {
        const swapped = swapBetween(board, step.beforeBoard);
        if (!swapped) fail('first cascade step does not start from one adjacent swap of the previous board');
        else if (index === 0) {
          if (action.type !== 'swap' || [action.from, action.to].sort().join() !== [...swapped].sort().join())
            fail('player step does not apply the requested swap');
        }
        moves.push({ actor: step.actor, skill: false, big: false, lastStep: index });
        combo = 1;
      } else {
        combo++;
        if (step.combo !== combo) fail(`combo ${step.combo} is not consecutive`);
        if (step.beforeBoard.join() !== board.join()) fail('cascade does not continue from the previous board');
        if (moves.at(-1)?.actor !== step.actor) fail('cascade changed actor');
        moves[moves.length - 1].lastStep = index;
      }
      const groups = refGroups(step.beforeBoard);
      const cleared = groups.flat().sort((a, b) => a - b);
      if (cleared.join() !== step.cleared.join()) fail('cleared cells differ from the reference matches');
      if (!cleared.length) fail('cascade step without a match');
      if (groups.some((group) => group.length >= 4)) moves[moves.length - 1].big = true;

      const count = (gem: Gem) => cleared.filter((cell) => step.beforeBoard![cell] === gem).length;

      if (count('luck') > 0 !== (step.luckReward !== undefined)) fail('luckReward presence does not match luck gems');

      const luck = (kind: string) => (step.luckReward === kind ? count('luck') : 0);

      const raw = count('attack') * R.attack + (count('attack') ? (step.combo - 1) * R.cascadeBonus : 0);
      const blocked = Math.min(foe.shield, raw);
      foe.shield -= blocked;
      foe.hp = Math.max(0, foe.hp - (raw - blocked));
      if (step.damage !== raw - blocked) fail(`damage ${step.damage} differs from reference ${raw - blocked}`);
      const healed = Math.min(R.health - owner.hp, (count('heal') + luck('heal')) * R.heal);
      owner.hp += healed;
      if (step.healed !== healed) fail(`healed ${step.healed} differs from reference ${healed}`);
      owner.mana = Math.min(R.mana, owner.mana + (count('mana') + luck('mana')) * R.manaPerGem);
      owner.shield = Math.min(R.shield, owner.shield + (count('shield') + luck('shield')) * R.shieldPerGem);
      if (step.actor === 'player') score += cleared.length * 10 * step.combo * (count('score') ? 2 : 1);
      if (!step.reshuffled) {
        const gone = new Set(cleared);
        for (let col = 0; col < 8; col++) {
          const kept = step.beforeBoard.filter((_, cell) => cell % 8 === col && !gone.has(cell));
          const column = step.board.filter((_, cell) => cell % 8 === col);
          if (column.slice(8 - kept.length).join() !== kept.join())
            fail('gravity did not keep the surviving gems in order');
        }
      }
      if (stat) stat.maxCombo = Math.max(stat.maxCombo, step.combo);
      if (step.combo > 32) fail('more than 32 cascades in one move');
    }
    if (step.board.length !== 64 || step.board.some((gem) => !GEM_TYPES.includes(gem))) fail('step board is not 8×8');
    for (const side of ['player', 'bot'] as const)
      if (JSON.stringify(step[side]) !== JSON.stringify(fighters[side]))
        fail(`${side} stats ${JSON.stringify(step[side])} differ from reference ${JSON.stringify(fighters[side])}`);
    if (step.score !== score) fail(`score ${step.score} differs from reference ${score}`);
    board = [...step.board];
    if (!fighters.bot.hp) status = 'won';
    else if (!fighters.player.hp) status = 'lost';
  });
  // turn structure
  const playerMoves = moves.filter((move) => move.actor === 'player');
  const botMoves = moves.filter((move) => move.actor === 'bot');
  if (playerMoves.length !== 1 || moves[0]?.actor !== 'player')
    fail('a request must hold exactly one player move first');
  const granted =
    !!playerMoves[0] &&
    !playerMoves[0].skill &&
    playerMoves[0].big &&
    (source.bonusTurns ?? 0) < R.maxBonusTurns &&
    status === 'playing';
  const playerDone = status !== 'playing' && !botMoves.length;
  if (!!result.extraTurn !== granted) fail(`extraTurn ${result.extraTurn} differs from reference ${granted}`);
  if (granted && botMoves.length) fail('bot moved although the player earned a bonus turn');
  if ((result.battle.bonusTurns ?? 0) !== (granted ? (source.bonusTurns ?? 0) + 1 : 0))
    fail('bonusTurns counter is wrong');
  if (!granted && !playerDone && !botMoves.length) fail('bot did not answer');
  if (botMoves.length > R.maxBonusTurns + 1) fail(`bot took ${botMoves.length} consecutive moves`);
  botMoves.forEach((move, index) => {
    const more = index < botMoves.length - 1;
    const flagged = !!result.steps[move.lastStep].extraTurn;
    if (flagged !== more) fail('bot extraTurn flag does not match the following move');
    if (more && (move.skill || !move.big)) fail('bot continued without a four-match');
    if (!more && !move.skill && move.big && index < R.maxBonusTurns && status === 'playing')
      fail('bot did not take an earned bonus turn');
  });
  if (playerMoves[0] && !!result.steps[playerMoves[0].lastStep].extraTurn !== granted)
    fail('player extraTurn flag is wrong');
  // final battle
  const battle = result.battle;
  if (battle.status !== status) fail(`status ${battle.status} differs from reference ${status}`);
  if (battle.board.join() !== board.join()) fail('final board differs from the last step');
  if (JSON.stringify(battle.player) !== JSON.stringify(fighters.player)) fail('final player differs');
  if (JSON.stringify(battle.bot) !== JSON.stringify(fighters.bot)) fail('final bot differs');
  if (refCleared(battle.board).length) fail('final board still holds a match');
  if (!refMoves(battle.board).length) fail('final board has no legal move');
  if (result.reshuffled !== result.steps.some((step) => step.reshuffled)) fail('reshuffled flag mismatch');
  if (battle.revision !== source.revision + 1 || battle.moves !== source.moves + 1) fail('revision/moves not advanced');
  for (const fighter of [battle.player, battle.bot])
    if (
      fighter.hp < 0 ||
      fighter.hp > R.health ||
      fighter.mana < 0 ||
      fighter.mana > R.mana ||
      fighter.shield < 0 ||
      fighter.shield > R.shield ||
      ![fighter.hp, fighter.mana, fighter.shield].every(Number.isInteger)
    )
      fail('fighter stats out of range');
  if (!isGemBattle(battle)) fail('battle fails isGemBattle');
  if (stat) {
    stat.botMoves += botMoves.length;
    stat.maxBotRun = Math.max(stat.maxBotRun, botMoves.length);
    stat.steps += result.steps.length;
    stat.maxSteps = Math.max(stat.maxSteps, result.steps.length);
    stat.reshuffles += Number(result.reshuffled);
  }
  return issues;
}

/** The bot's swap must be a pure function of the visible board and fighter stats (medium/hard). */
function verifyBotChoices(source: GemBattle, result: GemResult, difficulty: ArcadeDifficulty) {
  const issues: string[] = [];
  if (difficulty === 'easy') return issues;
  let board = [...source.board];
  let player = { ...source.player },
    bot = { ...source.bot };
  for (const step of result.steps) {
    if (step.actor === 'bot' && step.combo <= 1) {
      const visible: GemBattle = { ...source, seed: 0, board, player, bot };
      const expected = botLikeAction(visible, 'bot', difficulty, () => 0);
      if (step.combo === 0) {
        if (!('type' in expected)) issues.push('bot used its skill against its documented rule');
      } else if ('type' in expected) issues.push('bot swapped although its rule says skill');
      else {
        const swapped = swapBetween(board, step.beforeBoard!);
        if (swapped?.join() !== [expected.from, expected.to].join())
          issues.push('bot swap is not the visible-board best move');
      }
    }
    board = [...step.board];
    player = { ...step.player };
    bot = { ...step.bot };
  }
  return issues;
}

function simulate(seed: number, difficulty: ArcadeDifficulty, policy: Policy, stat: Stat, problems: string[]) {
  const tag = `diamonds seed=${seed} ${difficulty} ${policy}`;

  const fail = (message: string) => {
    if (problems.length < 20) problems.push(`${tag}: ${message}`);
  };

  const random = rng(seed * 31337 + 5);
  let battle = createGemBattle(`d${seed}`, 0, seed);
  battle.session = { hostId: 'local-player', mode: 'wager', stake: 100, difficulty, configured: true };
  if (refCleared(battle.board).length || !refMoves(battle.board).length)
    fail('initial board is not stable and playable');
  let requests = 0,
    run = 0;
  while (battle.status === 'playing') {
    if (++requests > 3000) return fail('did not terminate in 3000 player requests');
    if (!validGemMoves(battle.board).length && battle.player.mana < R.skillCost) return fail('no legal action');
    const action = choose(battle, policy, difficulty, random);
    const started = performance.now();
    let result: GemResult;
    try {
      result = playGemAction(battle, action);
    } catch (error) {
      return fail(`threw ${(error as Error).message} on ${JSON.stringify(action)}`);
    }
    const elapsed = performance.now() - started;
    stat.ms += elapsed;
    stat.maxMs = Math.max(stat.maxMs, elapsed);
    stat.times.push(elapsed);
    for (const issue of verifyResult(battle, action, result, stat)) fail(`request ${requests}: ${issue}`);
    for (const issue of verifyBotChoices(battle, result, difficulty)) fail(`request ${requests}: ${issue}`);
    try {
      decodeGemResult(result);
    } catch {
      fail('result fails the HTTP decoder');
    }
    run = result.extraTurn ? run + 1 : 0;
    stat.maxPlayerRun = Math.max(stat.maxPlayerRun, run);
    battle = result.battle;
  }
  stat.games++;
  stat.wins += Number(battle.status === 'won');
  stat.requests += requests;
  stat.maxRequests = Math.max(stat.maxRequests, requests);
  stat.score += battle.score;
}

const line = (label: string, s: Stat) =>
  `${label.padEnd(30)} n=${s.games} win=${((100 * s.wins) / s.games).toFixed(1)}% EV=${((200 * s.wins) / s.games - 100).toFixed(1)}xu/100 requests=${(s.requests / s.games).toFixed(1)} (max ${s.maxRequests}) steps/request=${(s.steps / s.requests).toFixed(2)} (max ${s.maxSteps}) reshuffle=${((100 * s.reshuffles) / s.requests).toFixed(2)}% requestMs p50=${pct(s.times, 0.5).toFixed(2)} p99=${pct(s.times, 0.99).toFixed(2)} max=${s.maxMs.toFixed(1)} botMoves/request=${(s.botMoves / s.requests).toFixed(2)} maxCombo=${s.maxCombo} maxBotRun=${s.maxBotRun} maxPlayerBonus=${s.maxPlayerRun} score=${(s.score / s.games).toFixed(0)}`;

describe.skipIf(ONLY && ONLY !== 'sim')('Kim cương simulation', () => {
  it('finds the same matches, groups and legal moves as the reference on random boards', () => {
    const random = rng(4242);
    for (let i = 0; i < 500; i++) {
      const palette = 2 + (i % 5);
      const board = Array.from({ length: 64 }, () => GEM_TYPES[Math.floor(random() * palette)]);
      const moves = validGemMoves(board);
      expect(moves.map((move) => `${move.from}-${move.to}`)).toEqual(refMoves(board).map(([a, b]) => `${a}-${b}`));
    }
  });
  for (const difficulty of DIFFICULTIES)
    it(`${difficulty}: every seeded battle follows DIAMOND_RULES step by step and terminates`, {
      timeout: 3_600_000,
    }, () => {
      const problems: string[] = [];
      const policies: Policy[] = ['random', 'hint', 'heuristic', 'mirror'];
      if (process.env.AUDIT_ORACLE) policies.push('seed-oracle');
      for (const policy of policies) {
        const stat = newStat();
        const games = policy === 'seed-oracle' ? Math.min(GAMES, 300) : GAMES;
        for (let seed = 1; seed <= games; seed++) simulate(seed, difficulty, policy, stat, problems);
        report(line(`diamonds ${difficulty} ${policy}`, stat));
        expect(stat.maxBotRun).toBeLessThanOrEqual(R.maxBonusTurns + 1);
        expect(stat.maxPlayerRun).toBeLessThanOrEqual(R.maxBonusTurns);
        expect(stat.maxCombo).toBeLessThanOrEqual(32);
        expect(pct(stat.times, 0.5)).toBeLessThan(100);
      }
      expect(problems).toEqual([]);
    });
  it('medium and hard bots answer identically whatever the hidden seed is', () => {
    for (const difficulty of ['medium', 'hard'] as const)
      for (let seed = 1; seed <= 40; seed++) {
        const battle = createGemBattle('b', 0, seed);
        battle.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty, configured: true };
        battle.player.mana = 100;
        const first = new Set<string>();
        for (let hidden = 0; hidden < 12; hidden++) {
          // The player's skill consumes no randomness, so the bot sees the same board under every hidden seed.
          const result = playGemAction({ ...battle, seed: (hidden * 2654435761) >>> 0 }, { type: 'skill' });
          const botStep = result.steps.find((step) => step.actor === 'bot')!;
          first.add(botStep.beforeBoard?.join() ?? 'skill');
        }
        expect(first.size).toBe(1);
      }
  });
  it('rejects illegal requests without consuming the turn', () => {
    const battle = createGemBattle('x', 0, 3);
    const before = JSON.stringify(battle);
    expect(() => playGemAction(battle, { type: 'skill' })).toThrow('NOT_ENOUGH_MANA');
    expect(() => playGemAction(battle, { type: 'swap', from: 7, to: 8 })).toThrow('INVALID_MOVE');
    expect(() => playGemAction(battle, { type: 'swap', from: 0, to: 9 })).toThrow('INVALID_MOVE');
    expect(() => playGemAction(battle, { type: 'swap', from: 0, to: 0 })).toThrow('INVALID_MOVE');
    expect(() => playGemAction(battle, { type: 'swap', from: 60, to: 68 })).toThrow('INVALID_MOVE');
    const legal = new Set(validGemMoves(battle.board).map((move) => `${move.from}-${move.to}`));
    for (let from = 0; from < 64; from++)
      for (const to of [from + 1, from + 8])
        if (to < 64 && adjacent(from, to) && !legal.has(`${from}-${to}`))
          expect(() => playGemAction(battle, { type: 'swap', from, to })).toThrow('NO_MATCH');
    expect(() => playGemAction(battle, { type: 'start' })).toThrow('INVALID_TURN');
    expect(() => playGemAction({ ...battle, status: 'won' }, { type: 'swap', from: 0, to: 1 })).toThrow(
      'MATCH_FINISHED',
    );
    expect(() => playGemAction({ ...battle, status: 'waiting' }, { type: 'skill' })).toThrow('MATCH_FINISHED');
    expect(JSON.stringify(battle)).toBe(before);
  });
});

it('public start, resume, lobby, play and retry receipts conceal the seed while stored state reloads', async () => {
  const repository = createMemoryRepository();
  const sdk = createLocalSdk({
    repository,

    clock: () => 42,
  });
  const input = { roomId: 0, requestId: 'public-start' };
  const waiting = await sdk.startDiamondRoom(input);

  const assertPublic = (value: unknown) => expect(collectKeys(value).has('seed')).toBe(false);

  assertPublic(waiting);
  assertPublic(await sdk.startDiamondRoom(input));
  assertPublic(await sdk.startDiamondRoom({ roomId: 0, requestId: 'resume-public' }));
  expect(decodeGemBattle(waiting)).toEqual(waiting);
  await sdk.configureArcadeTable({
    gameId: 'diamonds',
    matchId: waiting.id,
    revision: 0,
    requestId: 'public-config',
    stake: 100,
    difficulty: 'medium',
  });
  const command = { battleId: waiting.id, revision: 1, requestId: 'public-play', action: { type: 'start' as const } };
  const result = await sdk.playDiamond(command);
  assertPublic(result);
  expect([...collectKeys(result)].every((key) => RESULT_KEYS.has(key))).toBe(true);
  expect(await sdk.playDiamond(command)).toEqual(result);
  assertPublic(await sdk.getArcadeLobby());
  const stored = await repository.transaction((document) => structuredClone(document));
  expect(isGemBattle(stored.arcade!.activeBattle)).toBe(true);
  expect(Number.isInteger(stored.arcade!.activeBattle!.seed)).toBe(true);
  assertPublic(stored.arcade!.starts);
  assertPublic(stored.arcade!.requests);
  // Older saves contained seeded receipts; normalization must scrub those too.
  Object.assign(stored.arcade!.starts[input.requestId].battle, { seed: stored.arcade!.activeBattle!.seed });
  Object.assign(stored.arcade!.requests[command.requestId].result.battle, { seed: stored.arcade!.activeBattle!.seed });
  const reloaded = createLocalSdk({ repository: createMemoryRepository(JSON.parse(JSON.stringify(stored))) });
  assertPublic(await reloaded.startDiamondRoom(input));
  expect(await reloaded.playDiamond(command)).toEqual(result);
  assertPublic(await reloaded.getArcadeLobby());
});
it('diamonds rejects a stake whose winning balance would exceed the safe integer limit', async () => {
  const document = createLocalDocument();
  document.farm.coins = Number.MAX_SAFE_INTEGER - 10;
  const repository = createMemoryRepository(document);
  const sdk = createLocalSdk({ repository });
  const waiting = await sdk.startDiamondRoom({ roomId: 0, requestId: 'overflow' });
  const before = await repository.transaction((value) => structuredClone(value));
  await expect(
    sdk.configureArcadeTable({
      gameId: 'diamonds',
      matchId: waiting.id,
      revision: 0,
      requestId: 'too-large',
      stake: 11,
      difficulty: 'medium',
    }),
  ).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
  expect(await repository.transaction((value) => structuredClone(value))).toEqual(before);
  await sdk.configureArcadeTable({
    gameId: 'diamonds',
    matchId: waiting.id,
    revision: 0,
    requestId: 'safe',
    stake: 10,
    difficulty: 'medium',
  });
  await repository.transaction((value) => {
    const battle = value.arcade!.activeBattle!;
    battle.player.mana = 60;
    battle.bot.hp = 1;
  });
  await sdk.playDiamond({ battleId: waiting.id, revision: 1, requestId: 'safe-start', action: { type: 'start' } });
  const won = await sdk.playDiamond({
    battleId: waiting.id,
    revision: 2,
    requestId: 'safe-win',
    action: { type: 'skill' },
  });
  expect(won.battle.status).toBe('won');
  expect((await sdk.getInventory()).farm.coins).toBe(Number.MAX_SAFE_INTEGER);
});
