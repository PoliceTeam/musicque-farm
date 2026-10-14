import {
  createPhomMatch,
  isPhomMatch,
  isPhomMeld,
  isPhomSnapshot,
  type PhomMatch,
  phomBotAction,
  phomRank,
  phomSendTargets,
  phomSnapshot,
  playPhomAction,
  solvePhom,
} from '@chibi-town/arcade-games/phom-logic';
import { expect, it } from 'vitest';

const c = (rank: number, suit = 0) => ((rank + 10) % 13) * 4 + suit;

function fixture(): PhomMatch {
  const m = createPhomMatch('fixture', 3, 42);
  m.status = 'playing';
  m.phase = 'receive';
  m.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty: 'medium', playerCount: 2 };
  m.hands[0] = [c(3), c(4), c(8), c(9, 1), c(11, 2), c(12, 3), c(2, 3), c(6, 1), c(7, 2)];
  m.hands[1] = [c(1), c(2), c(10), c(3, 1), c(4, 1), c(5, 1), c(6, 2), c(10, 3), c(13, 3)];
  m.discards[1] = [c(5)];
  m.last = { card: c(5), seat: 1 };
  m.stock = Array.from({ length: 52 }, (_, i) => i).filter(
    (card) => ![...m.hands.flat(), ...m.discards.flat()].includes(card),
  );
  return m;
}

it('recognizes A-2-3 and rank sets, rejecting K-A wrap, mixed suits and duplicate cards', () => {
  expect(isPhomMeld([c(1), c(2), c(3)])).toBe(true);
  expect(isPhomMeld([c(13), c(1), c(2)])).toBe(false);
  expect(isPhomMeld([c(8), c(8, 1), c(8, 2), c(8, 3)])).toBe(true);
  expect(isPhomMeld([c(3), c(4, 1), c(5)])).toBe(false);
  expect(isPhomMeld([c(3), c(3), c(3)])).toBe(false);
  expect(phomRank(c(1))).toBe(1);
  expect(phomRank(c(13))).toBe(13);
});
it('finds an optimal disjoint partition while preserving eaten-card constraints', () => {
  const hand = [c(3), c(4), c(5), c(5, 1), c(5, 2), c(6), c(7), c(8), c(9), c(13, 3)];
  const result = solvePhom(hand);
  expect(result.points).toBe(20);
  expect(result.melds.flat().length).toBe(7);
  expect(new Set(result.melds.flat()).size).toBe(7);
  expect(() => solvePhom([c(3), c(4), c(5)], [c(3), c(5)])).toThrow('INVALID_PLAY');
  expect(() => solvePhom([c(3), c(4), c(9)], [c(9)])).toThrow('INVALID_PLAY');
});
it('allows an eat only when every eaten card stays in a valid meld and protects it from discarding', () => {
  const m = fixture(),
    before = JSON.stringify(m);
  expect(isPhomMatch(m)).toBe(true);
  const next = playPhomAction(m, { type: 'eat' }).state;
  expect(JSON.stringify(m)).toBe(before);
  expect(next.eaten[0]).toContain(c(5));
  expect(next.discards[1]).toEqual([]);
  expect(isPhomMatch(next)).toBe(true);
  expect(() => playPhomAction(next, { type: 'discard', card: c(5) })).toThrow('INVALID_PLAY');
  expect(() => playPhomAction({ ...m, last: { card: c(13, 1), seat: 1 } }, { type: 'eat' })).toThrow('INVALID_PLAY');
});
it('rejects drawing twice and lays before the fourth discard', () => {
  const m = fixture();
  m.turns[0] = 3;
  const next = playPhomAction(m, { type: 'draw' }).state;
  expect(next.phase).toBe('lay');
  expect(() => playPhomAction(next, { type: 'discard', card: next.hands[0][0] })).toThrow('INVALID_PLAY');
  expect(() => playPhomAction(next, { type: 'draw' })).toThrow('INVALID_TURN');
  const laid = playPhomAction(next, { type: 'lay' }).state;
  expect(laid.laid[0]).toBe(true);
  expect(laid.phase).toBe('send');
});
it('sends only legal extensions to exposed melds and conserves all 52 cards', () => {
  const m = fixture();
  m.phase = 'send';
  m.laid[0] = true;
  m.laid[1] = true;
  m.melds[0] = [[c(3), c(4), c(5)]];
  m.hands[0] = m.hands[0].filter((card) => ![c(3), c(4)].includes(card));
  m.discards[1] = [];
  delete m.last;
  const meld = [c(3, 1), c(4, 1), c(5, 1)];
  m.melds[1] = [meld];
  m.hands[1] = m.hands[1].filter((card) => !meld.includes(card));
  const targets = phomSendTargets(phomSnapshot(m));
  expect(targets).toContainEqual({ card: c(6, 1), seat: 1, meld: 0 });
  const next = playPhomAction(m, { type: 'send', card: c(6, 1), seat: 1, meld: 0 }).state;
  expect(next.melds[1][0]).toContain(c(6, 1));
  expect(isPhomMatch(next)).toBe(true);
  expect(() => playPhomAction(m, { type: 'send', card: c(13, 3), seat: 1, meld: 0 })).toThrow('INVALID_PLAY');
});
it('finishes immediately on ù and ranks it first', () => {
  const m = fixture();
  m.phase = 'discard';
  m.hands[0] = [c(3), c(4), c(5), c(6), c(7), c(8), c(9), c(10), c(11), c(13)];
  m.hands[1] = [];
  m.discards = [[], [], [], []];
  delete m.last;
  m.stock = Array.from({ length: 52 }, (_, i) => i).filter((card) => !m.hands[0].includes(card));
  const next = playPhomAction(m, { type: 'discard', card: c(13) }).state;
  expect(next.status).toBe('finished');
  expect(next.u).toBe(0);
  expect(next.placements?.[0]).toBe(0);
  expect(isPhomMatch(next)).toBe(true);
});
for (const count of [2, 3, 4] as const)
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    it(`completes seeded ${count}-seat ${difficulty} games with private snapshots and conserved cards`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        let m = createPhomMatch(`game-${seed}`, 3, seed);
        m.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty, playerCount: count };
        m = playPhomAction(m, { type: 'start' }).state;
        expect(m.hands.slice(0, count).map((h) => h.length)).toEqual([10, ...Array(count - 1).fill(9)]);
        expect(isPhomMatch(m)).toBe(true);
        for (let i = 0; m.status === 'playing'; i++) {
          expect(i).toBeLessThan(40);
          const action = phomBotAction(m);
          m = playPhomAction(m, action).state;
          expect(isPhomMatch(m)).toBe(true);
          const snapshot = phomSnapshot(m);
          expect(isPhomSnapshot(snapshot)).toBe(true);
          expect(snapshot).not.toHaveProperty('hands');
          expect(snapshot).not.toHaveProperty('stock');
          expect(snapshot).not.toHaveProperty('seed');
        }
        expect(m.placements).toHaveLength(count);
        expect(m.scores).toHaveLength(4);
      }
    });
it('rejects corrupt saves, duplicate cards and invalid ranks', () => {
  const m = fixture();
  expect(isPhomMatch({ ...m, stock: [...m.stock, m.hands[0][0]] })).toBe(false);
  expect(isPhomSnapshot({ ...phomSnapshot(m), hand: [99] })).toBe(false);
  expect(isPhomMatch({ ...m, turn: 7 })).toBe(false);
});
it('ranks móm after any exposed meld and breaks equal scores by earlier laying order', () => {
  const m = createPhomMatch('ranks', 3, 1);
  m.session = { hostId: 'local-player', mode: 'practice', stake: 0, difficulty: 'medium', playerCount: 4 };
  m.status = 'playing';
  m.phase = 'discard';
  m.turns = [3, 4, 4, 4];
  m.laid = [true, true, true, true];
  m.hands = [[c(1), c(2)], [c(8)], [c(8, 1)], [c(12)]];
  m.melds = [[], [[c(7), c(7, 1), c(7, 2)]], [[c(9), c(9, 1), c(9, 2)]], [[c(10), c(10, 1), c(10, 2)]]];
  m.stock = Array.from({ length: 52 }, (_, i) => i).filter(
    (card) => ![...m.hands.flat(), ...m.melds.flat(2)].includes(card),
  );
  const result = playPhomAction(m, { type: 'discard', card: c(2) }).state;
  expect(result.placements).toEqual([1, 2, 3, 0]);
  expect(result.mom?.[0]).toBe(true);
  expect(isPhomMatch(result)).toBe(true);
});
