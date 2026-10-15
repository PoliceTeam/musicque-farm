import { DIAMOND_RULES, validSavedArcadeSeat } from '@chibi-town/game-content/arcade-catalog';
import { isRandomSeed, normalizeSeed, type RandomSeed, random } from './random.js';
import { type ArcadeSession, validArcadeSession } from './session.js';
import type { TableSnapshot } from './table-snapshot.js';
export const GEM_TYPES = ['attack', 'heal', 'mana', 'score', 'shield', 'luck'] as const;
export type Gem = (typeof GEM_TYPES)[number];
export type GemFighter = { hp: number; mana: number; shield: number };
export type GemBattle = {
  id: string;
  roomId: number;
  tableId?: number;
  session?: ArcadeSession;
  seed: RandomSeed;
  board: Gem[];
  player: GemFighter;
  bot: GemFighter;
  status: 'waiting' | 'playing' | 'won' | 'lost';
  moves: number;
  score: number;
  revision: number;
  bonusTurns?: number;
  turn?: 0 | 1;
};
export type GemAction = { type: 'start' } | { type: 'swap'; from: number; to: number } | { type: 'skill' };
export type GemStep = {
  actor: 'player' | 'bot';
  player: GemFighter;
  bot: GemFighter;
  score: number;
  cleared: number[];
  board: Gem[];
  damage: number;
  healed: number;
  combo: number;
  beforeBoard?: Gem[];
  extraTurn?: boolean;
  reshuffled?: boolean;
  luckReward?: 'heal' | 'mana' | 'shield';
};
export type GemResult = { battle: GemBattle; steps: GemStep[]; reshuffled: boolean; extraTurn?: boolean };
export type GemBattleSnapshot = Omit<GemBattle, 'seed'> & TableSnapshot<GemStep>;
export type GemPublicResult = Omit<GemResult, 'battle'> & { battle: GemBattleSnapshot };

export function gemBattleSnapshot(battle: GemBattleSnapshot): GemBattleSnapshot {
  const { seed: _seed, ...snapshot } = battle as GemBattle;
  return JSON.parse(JSON.stringify(snapshot)) as GemBattleSnapshot;
}

export function gemPublicResult(result: GemPublicResult): GemPublicResult {
  return { ...(JSON.parse(JSON.stringify(result)) as GemPublicResult), battle: gemBattleSnapshot(result.battle) };
}

const SIZE = DIAMOND_RULES.size;

/** Merge intersecting runs, so T/L shapes qualify but separate triples do not. */
export function gemMatchGroups(board: readonly Gem[]): number[][] {
  const groups: Set<number>[] = [];
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < SIZE; col++) {
      const i = row * SIZE + col;
      for (const stride of [1, SIZE]) {
        if (stride === 1 ? col > SIZE - 3 : row > SIZE - 3) continue;
        if (board[i] !== board[i + stride] || board[i] !== board[i + 2 * stride]) continue;
        const group = new Set([i, i + stride, i + 2 * stride]);
        let overlap = groups.findIndex((other) => [...other].some((index) => group.has(index)));
        while (overlap !== -1) {
          for (const index of groups[overlap]) group.add(index);
          groups.splice(overlap, 1);
          overlap = groups.findIndex((other) => [...other].some((index) => group.has(index)));
        }
        groups.push(group);
      }
    }
  return groups.map((group) => [...group].sort((a, b) => a - b));
}

export function gemMatches(board: readonly Gem[]) {
  return [...new Set(gemMatchGroups(board).flat())].sort((a, b) => a - b);
}

export function earnsGemExtraTurn(board: readonly Gem[]) {
  return gemMatchGroups(board).some((group) => group.length >= 4);
}

export function adjacentGems(from: number, to: number) {
  return (
    Number.isSafeInteger(from) &&
    Number.isSafeInteger(to) &&
    from >= 0 &&
    to >= 0 &&
    from < SIZE * SIZE &&
    to < SIZE * SIZE &&
    (Math.abs(from - to) === SIZE || (Math.abs(from - to) === 1 && Math.floor(from / SIZE) === Math.floor(to / SIZE)))
  );
}

export function validGemMoves(board: readonly Gem[]) {
  const moves: { from: number; to: number; matched: number[] }[] = [];
  for (let i = 0; i < board.length; i++)
    for (const j of [i + 1, i + SIZE]) {
      if (!adjacentGems(i, j)) continue;
      const swapped = [...board];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      const matched = gemMatches(swapped);
      if (matched.length) moves.push({ from: i, to: j, matched });
    }
  return moves;
}

function freshBoard(state: { seed: RandomSeed }) {
  for (let attempt = 0; attempt < 128; attempt++) {
    const board: Gem[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const choices = GEM_TYPES.filter(
        (gem) =>
          !(i % SIZE >= 2 && board[i - 1] === gem && board[i - 2] === gem) &&
          !(i >= 2 * SIZE && board[i - SIZE] === gem && board[i - 2 * SIZE] === gem),
      );
      board.push(choices[Math.floor(random(state) * choices.length)]);
    }
    if (validGemMoves(board).length) return board;
  }
  throw new Error('BOARD_UNAVAILABLE');
}

export function createGemBattle(id: string, roomId: number, seed: RandomSeed, tableId = 0): GemBattle {
  const state = { seed: normalizeSeed(seed) };
  const board = freshBoard(state);
  return {
    id,
    roomId,
    tableId,
    seed: state.seed,
    board,
    player: { hp: DIAMOND_RULES.health, mana: 0, shield: 0 },
    bot: { hp: DIAMOND_RULES.health, mana: 0, shield: 0 },
    status: 'playing',
    moves: 0,
    score: 0,
    revision: 0,
  };
}

function damage(fighter: GemFighter, amount: number) {
  const blocked = Math.min(fighter.shield, amount);
  fighter.shield -= blocked;
  fighter.hp = Math.max(0, fighter.hp - (amount - blocked));
  return amount - blocked;
}

function updateStatus(battle: GemBattle) {
  if (!battle.bot.hp) battle.status = 'won';
  else if (!battle.player.hp) battle.status = 'lost';
}

function resolve(battle: GemBattle, actor: 'player' | 'bot', steps: GemStep[]) {
  let combo = 0;
  let extraTurn = false,
    reshuffled = false;
  while (combo < 32) {
    const cleared = gemMatches(battle.board);
    if (!cleared.length) break;
    combo++;
    extraTurn ||= earnsGemExtraTurn(battle.board);
    const beforeBoard = [...battle.board];
    const owner = battle[actor],
      opponent = battle[actor === 'player' ? 'bot' : 'player'];
    const counts = Object.fromEntries(
      GEM_TYPES.map((gem) => [gem, cleared.filter((i) => battle.board[i] === gem).length]),
    ) as Record<Gem, number>;
    const luckReward = counts.luck ? (['heal', 'mana', 'shield'] as const)[Math.floor(random(battle) * 3)] : undefined;
    const dealt = damage(
      opponent,
      counts.attack * DIAMOND_RULES.attack + (counts.attack ? (combo - 1) * DIAMOND_RULES.cascadeBonus : 0),
    );
    const healed = Math.min(
      DIAMOND_RULES.health - owner.hp,
      (counts.heal + (luckReward === 'heal' ? counts.luck : 0)) * DIAMOND_RULES.heal,
    );
    owner.hp += healed;
    owner.mana = Math.min(
      DIAMOND_RULES.mana,
      owner.mana + (counts.mana + (luckReward === 'mana' ? counts.luck : 0)) * DIAMOND_RULES.manaPerGem,
    );
    owner.shield = Math.min(
      DIAMOND_RULES.shield,
      owner.shield + (counts.shield + (luckReward === 'shield' ? counts.luck : 0)) * DIAMOND_RULES.shieldPerGem,
    );
    if (actor === 'player') battle.score += cleared.length * 10 * combo * (counts.score ? 2 : 1);
    const mask = new Set(cleared);
    for (let col = 0; col < SIZE; col++) {
      const retained = battle.board.filter((_, index) => index % SIZE === col && !mask.has(index));
      const missing = SIZE - retained.length;
      for (let row = 0; row < SIZE; row++)
        battle.board[row * SIZE + col] =
          row < missing ? GEM_TYPES[Math.floor(random(battle) * GEM_TYPES.length)] : retained[row - missing];
    }
    steps.push({
      actor,
      player: { ...battle.player },
      bot: { ...battle.bot },
      score: battle.score,
      cleared,
      board: [...battle.board],
      damage: dealt,
      healed,
      combo,
      beforeBoard,
      luckReward,
    });
    updateStatus(battle);
    if (battle.status !== 'playing') break;
  }
  if (combo === 32 || !validGemMoves(battle.board).length) {
    battle.board = freshBoard(battle);
    reshuffled = true;
    steps[steps.length - 1].board = [...battle.board];
    steps[steps.length - 1].reshuffled = true;
  }
  return { extraTurn, reshuffled };
}

function skill(battle: GemBattle, actor: 'player' | 'bot', steps: GemStep[]) {
  if (battle[actor].mana < DIAMOND_RULES.skillCost) throw new Error('NOT_ENOUGH_MANA');
  battle[actor].mana -= DIAMOND_RULES.skillCost;
  const dealt = damage(battle[actor === 'player' ? 'bot' : 'player'], DIAMOND_RULES.skillDamage);
  steps.push({
    actor,
    player: { ...battle.player },
    bot: { ...battle.bot },
    score: battle.score,
    cleared: [],
    board: [...battle.board],
    damage: dealt,
    healed: 0,
    combo: 0,
  });
  updateStatus(battle);
}

/** Evaluate only visible gems after swapping; never inspect the random seed/future drops. */
export function bestGemMove(
  battle: GemBattleSnapshot,
  actor: 'player' | 'bot',
  difficulty: 'medium' | 'hard' = 'medium',
) {
  const owner = battle[actor];
  return validGemMoves(battle.board)
    .map((move) => {
      const board = [...battle.board];
      [board[move.from], board[move.to]] = [board[move.to], board[move.from]];
      const value =
        move.matched.reduce((sum, i) => {
          const gem = board[i];
          return (
            sum +
            (gem === 'attack'
              ? DIAMOND_RULES.attack
              : gem === 'heal'
                ? Math.min(DIAMOND_RULES.heal, (DIAMOND_RULES.health - owner.hp) / move.matched.length)
                : gem === 'mana'
                  ? Math.min(30, (DIAMOND_RULES.mana - owner.mana) / move.matched.length)
                  : gem === 'shield'
                    ? Math.min(DIAMOND_RULES.shieldPerGem, (DIAMOND_RULES.shield - owner.shield) / move.matched.length)
                    : gem === 'luck'
                      ? 15
                      : 1)
          );
        }, 0) +
        (earnsGemExtraTurn(board) ? (difficulty === 'hard' ? 300 : 100) : 0) +
        (difficulty === 'hard' && owner.hp < 300 ? move.matched.filter((i) => board[i] === 'heal').length * 50 : 0);
      return { ...move, value };
    })
    .sort((a, b) => b.value - a.value || a.from - b.from || a.to - b.to)[0];
}

export function gemSeatSnapshot(source: GemBattle, viewer: number): GemBattleSnapshot {
  const battle = gemBattleSnapshot(source);
  return {
    ...battle,
    player: viewer === 1 ? battle.bot : battle.player,
    bot: viewer === 1 ? battle.player : battle.bot,
    turn: (battle.turn ?? 0) === viewer ? 0 : 1,
    status:
      viewer === 1
        ? battle.status === 'won'
          ? 'lost'
          : battle.status === 'lost'
            ? 'won'
            : battle.status
        : battle.status,
    session: battle.session && {
      ...battle.session,
      coinDelta: battle.session.coinDeltas?.[viewer] ?? battle.session.coinDelta,
      coinDeltas:
        battle.session.coinDeltas &&
        (viewer === 1
          ? [battle.session.coinDeltas[1], battle.session.coinDeltas[0], 0, 0]
          : [...battle.session.coinDeltas]),
    },
  };
}

export function playGemSeatAction(source: GemBattle, seat: number, action: GemAction) {
  if ((source.turn ?? 0) !== seat) throw new Error('INVALID_TURN');
  const battle: GemBattle = {
    ...source,
    session: source.session && { ...source.session },
    board: [...source.board],
    player: { ...source.player },
    bot: { ...source.bot },
  };
  const steps: GemStep[] = [];
  let extraTurn = false,
    reshuffled = false;
  if (action.type === 'start') {
    if (battle.status !== 'waiting') throw new Error('INVALID_TURN');
    battle.status = 'playing';
    battle.turn = 0;
  } else {
    if (battle.status !== 'playing') throw new Error('MATCH_FINISHED');
    const actor = seat === 0 ? 'player' : 'bot';
    if (action.type === 'skill') skill(battle, actor, steps);
    else {
      if (!adjacentGems(action.from, action.to)) throw new Error('INVALID_MOVE');
      [battle.board[action.from], battle.board[action.to]] = [battle.board[action.to], battle.board[action.from]];
      if (!gemMatches(battle.board).length) throw new Error('NO_MATCH');
      const resolved = resolve(battle, actor, steps);
      reshuffled = resolved.reshuffled;
      extraTurn =
        resolved.extraTurn && (battle.bonusTurns ?? 0) < DIAMOND_RULES.maxBonusTurns && battle.status === 'playing';
    }
    battle.bonusTurns = extraTurn ? (battle.bonusTurns ?? 0) + 1 : 0;
    if (extraTurn) steps[steps.length - 1].extraTurn = true;
    battle.turn = extraTurn ? (seat as 0 | 1) : seat === 0 ? 1 : 0;
    battle.moves++;
  }
  battle.revision++;
  return {
    state: battle,

    result: (viewer: number): GemPublicResult => ({
      battle: gemSeatSnapshot(battle, viewer),
      reshuffled,
      extraTurn,
      steps: steps.map((step) =>
        viewer === 1
          ? { ...step, actor: step.actor === 'player' ? 'bot' : 'player', player: step.bot, bot: step.player }
          : step,
      ),
    }),
  };
}

export function playGemAction(source: GemBattle, action: GemAction): GemResult {
  if (action.type === 'start') {
    if (source.status !== 'waiting') throw new Error('INVALID_TURN');
    return {
      battle: {
        ...source,
        session: source.session ? { ...source.session } : undefined,
        board: [...source.board],
        player: { ...source.player },
        bot: { ...source.bot },
        status: 'playing',
        revision: source.revision + 1,
      },
      steps: [],
      reshuffled: false,
      extraTurn: false,
    };
  }
  if (source.status !== 'playing') throw new Error('MATCH_FINISHED');
  const battle = {
    ...source,
    session: source.session ? { ...source.session } : undefined,
    board: [...source.board],
    player: { ...source.player },
    bot: { ...source.bot },
  };
  const steps: GemStep[] = [];
  let reshuffled = false,
    extraTurn = false;
  if (action.type === 'skill') skill(battle, 'player', steps);
  else {
    if (!adjacentGems(action.from, action.to)) throw new Error('INVALID_MOVE');
    [battle.board[action.from], battle.board[action.to]] = [battle.board[action.to], battle.board[action.from]];
    if (!gemMatches(battle.board).length) throw new Error('NO_MATCH');
    const resolved = resolve(battle, 'player', steps);
    reshuffled ||= resolved.reshuffled;
    extraTurn =
      resolved.extraTurn && (battle.bonusTurns ?? 0) < DIAMOND_RULES.maxBonusTurns && battle.status === 'playing';
  }
  battle.bonusTurns = extraTurn ? (battle.bonusTurns ?? 0) + 1 : 0;
  if (extraTurn) steps[steps.length - 1].extraTurn = true;
  if (!extraTurn) {
    for (let bonus = 0; battle.status === 'playing'; bonus++) {
      const difficulty = battle.session?.difficulty ?? 'medium';
      const hardMove = difficulty === 'hard' ? bestGemMove(battle, 'bot', 'hard') : undefined;
      if (
        battle.bot.mana >= DIAMOND_RULES.skillCost &&
        (!hardMove ||
          battle.player.hp + battle.player.shield <= DIAMOND_RULES.skillDamage ||
          hardMove.value < DIAMOND_RULES.skillDamage)
      ) {
        skill(battle, 'bot', steps);
        break;
      }
      const choices = validGemMoves(battle.board);
      const best =
        difficulty === 'easy'
          ? choices[Math.floor(random(battle) * choices.length)]
          : bestGemMove(battle, 'bot', difficulty);
      if (!best) break;
      [battle.board[best.from], battle.board[best.to]] = [battle.board[best.to], battle.board[best.from]];
      const resolved = resolve(battle, 'bot', steps);
      reshuffled ||= resolved.reshuffled;
      if (!resolved.extraTurn || bonus >= DIAMOND_RULES.maxBonusTurns || battle.status !== 'playing') break;
      steps[steps.length - 1].extraTurn = true;
    }
  }
  if (gemMatches(battle.board).length || !validGemMoves(battle.board).length) {
    battle.board = freshBoard(battle);
    reshuffled = true;
    steps[steps.length - 1].board = [...battle.board];
    steps[steps.length - 1].reshuffled = true;
  }
  battle.moves++;
  battle.revision++;
  return { battle, steps, reshuffled, extraTurn };
}

export function isGemBattle(value: unknown): value is GemBattle {
  const battle = value as GemBattle;
  return isGemBattleSnapshot(value) && isRandomSeed(battle.seed);
}

export function isGemBattleSnapshot(value: unknown): value is GemBattleSnapshot {
  const b = value as GemBattle;
  return (
    !!b &&
    typeof b.id === 'string' &&
    validSavedArcadeSeat(b.roomId, b.tableId) &&
    (b.session === undefined || validArcadeSession(b.session)) &&
    Array.isArray(b.board) &&
    b.board.length === 64 &&
    b.board.every((gem) => GEM_TYPES.includes(gem)) &&
    ['waiting', 'playing', 'won', 'lost'].includes(b.status) &&
    (b.turn === undefined || [0, 1].includes(b.turn)) &&
    [b.player, b.bot].every(
      (f) =>
        !!f &&
        Number.isSafeInteger(f.hp) &&
        f.hp >= 0 &&
        f.hp <= 1000 &&
        Number.isSafeInteger(f.mana) &&
        f.mana >= 0 &&
        f.mana <= 100 &&
        Number.isSafeInteger(f.shield) &&
        f.shield >= 0 &&
        f.shield <= 300,
    ) &&
    (b.bonusTurns === undefined ||
      (Number.isSafeInteger(b.bonusTurns) && b.bonusTurns >= 0 && b.bonusTurns <= DIAMOND_RULES.maxBonusTurns)) &&
    [b.moves, b.score, b.revision].every((n) => Number.isSafeInteger(n) && n >= 0)
  );
}
