import {
  createTienMatch,
  forfeitTienSeat,
  isTienMatch,
  isTienSnapshot,
  legalTienPlays,
  playTienSeatAction,
  type TienMatch,
  tienSeatSnapshot,
} from '@chibi-town/arcade-games/tien-len-logic';
import { expect, it } from 'vitest';

function fixture(count: 2 | 3 | 4 = 4, seed = 123): TienMatch {
  const match = createTienMatch('forfeit', 0, seed);
  match.session = {
    hostId: 'p0',
    mode: 'wager',
    difficulty: 'medium',
    stake: 100,
    configured: true,
    payoutRule: 'ranked-pool',
    playerCount: count,
  };
  return playTienSeatAction(match, 0, { type: 'start' }).state;
}

function orderedFixture() {
  const match = fixture();
  match.hands = Array.from({ length: 4 }, (_, seat) => Array.from({ length: 13 }, (_, i) => seat * 13 + i));
  match.turn = 0;
  match.opening = false;
  return match;
}

function assertValid(match: TienMatch) {
  expect(isTienMatch(match)).toBe(true);
  for (let viewer = 0; viewer < (match.session?.playerCount ?? 4); viewer++) {
    const snapshot = tienSeatSnapshot(match, viewer);
    expect(isTienSnapshot(snapshot)).toBe(true);
    expect(snapshot.hand).toEqual(match.hands[viewer]);
    expect(snapshot.forfeited).toEqual(
      match.forfeited?.map((seat) => (seat - viewer + match.session!.playerCount!) % match.session!.playerCount!),
    );
    expect(JSON.stringify(snapshot)).not.toContain('"hands"');
    expect(JSON.stringify(snapshot)).not.toContain('"seed"');
  }
}

it.each([2, 3, 4] as const)(
  'audits %i-seat games with a forfeit: legal turns, hidden cards and earned placements',
  (count) => {
    for (let seed = 1; seed <= 12; seed++) {
      let match = fixture(count);
      match.seed = seed;
      const eliminated = seed % count;
      const before = structuredClone(match);
      match = forfeitTienSeat(match, eliminated);
      expect(before.forfeited).toBeUndefined();
      expect(match.hands[eliminated]).toEqual(before.hands[eliminated]);
      expect(match.played).toEqual(before.played);
      assertValid(match);
      let turns = 0;
      while (match.status === 'playing' && turns++ < 400) {
        expect(match.turn).not.toBe(eliminated);
        const play = legalTienPlays(match.hands[match.turn], match.pile, match.opening, match.openingCard)[0];
        match = playTienSeatAction(
          match,
          match.turn,
          play ? { type: 'play', cards: play.cards } : { type: 'pass' },
        ).state;
        assertValid(match);
      }
      expect(match.status).toBe('finished');
      expect(match.placements).not.toContain(eliminated);
      expect(match.placements).toHaveLength(count === 2 ? 1 : 2);
      expect(() => forfeitTienSeat(match, eliminated)).toThrow('INVALID_TURN');
    }
  },
);

it('skips a forfeited pile owner when all remaining players pass', () => {
  const initial = orderedFixture();
  const played = playTienSeatAction(initial, 0, { type: 'play', cards: [0] }).state;
  let match = forfeitTienSeat(played, 0);
  expect(match.pile).toEqual(played.pile);
  for (const seat of [1, 2, 3]) match = playTienSeatAction(match, seat, { type: 'pass' }).state;
  expect(match.turn).toBe(1);
  expect(match.pile).toBeUndefined();
  expect(match.passed).toEqual([]);
  expect(match.hands[0]).toEqual(played.hands[0]);
  assertValid(match);
});

it('removes an eliminated passing seat and advances an eliminated current turn without reviving either', () => {
  let match = playTienSeatAction(orderedFixture(), 0, { type: 'play', cards: [0] }).state;
  match = playTienSeatAction(match, 1, { type: 'pass' }).state;
  match = forfeitTienSeat(match, 1);
  expect(match.turn).toBe(2);
  expect(match.passed).toEqual([]);
  match = forfeitTienSeat(match, 2);
  expect(match.turn).toBe(3);
  match = playTienSeatAction(match, 3, { type: 'pass' }).state;
  expect(match.turn).toBe(0);
  expect(match.pile).toBeUndefined();
  assertValid(match);
});

it('reassigns the opening card only among live hands when the opening seat forfeits', () => {
  const before = fixture();
  const match = forfeitTienSeat(before, before.turn);
  expect(match.opening).toBe(true);
  expect(match.turn).not.toBe(before.turn);
  expect(match.openingCard).toBe(Math.min(...match.hands.flatMap((hand, seat) => (seat === before.turn ? [] : hand))));
  expect(match.hands[before.turn]).toEqual(before.hands[before.turn]);
  const play = legalTienPlays(match.hands[match.turn], undefined, true, match.openingCard)[0];
  assertValid(playTienSeatAction(match, match.turn, { type: 'play', cards: play.cards }).state);
});

it('accepts legacy matches and rejects invalid, duplicate, active or placed forfeiture entries', () => {
  const legacy = orderedFixture();
  assertValid(legacy);
  for (const forfeited of [[-1], [4], [1, 1], [0, 1, 2, 3], [0], 'bad']) {
    expect(isTienMatch({ ...legacy, forfeited })).toBe(false);
  }
  const match = forfeitTienSeat(legacy, 1);
  assertValid(match);
  expect(isTienMatch({ ...match, placements: [1], winner: 1 })).toBe(false);
  expect(() => playTienSeatAction(match, 1, { type: 'play', cards: [13] })).toThrow('INVALID_TURN');
  expect(() => forfeitTienSeat(match, 1)).toThrow('INVALID_TURN');
});
