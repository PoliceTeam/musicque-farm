import { createMiniMatch, miniMemberCoinDeltas } from '@chibi-town/arcade-games/mini-games-logic';
import { validArcadeSession } from '@chibi-town/arcade-games/session';
import { expect, it } from 'vitest';

it('accepts all-win and all-loss house payouts without weakening zero-sum ranked pools', () => {
  const match = createMiniMatch('slots', 'house-payout', 0, 42);
  match.status = 'finished';
  match.roll = [5, 5, 5];
  match.multiplier = 10;
  match.outcome = 'win';
  match.reason = 'spin';
  match.session = {
    hostId: 'local-player',
    mode: 'wager',
    stake: 100,
    difficulty: 'medium',
    members: [
      { id: 'local-player', ready: true, stake: 100 },
      { id: 'b1', ready: true, stake: 50 },
      { id: 'b2', ready: true, stake: 200 },
      { id: 'b3', ready: true, stake: 300 },
    ],
  };
  const wins = miniMemberCoinDeltas(match);
  expect(wins.map((p) => p.delta)).toEqual([900, 450, 1800, 2700]);
  match.session.housePayouts = wins.map((p) => ({ ...p, coinsAfter: 10000 + p.delta }));
  expect(validArcadeSession(match.session)).toBe(true);
  match.multiplier = 0;
  match.roll = [0, 1, 2];
  const losses = miniMemberCoinDeltas(match);
  expect(losses.map((p) => p.delta)).toEqual([-100, -50, -200, -300]);
  match.session.housePayouts = losses.map((p) => ({ ...p, coinsAfter: 10000 + p.delta }));
  expect(validArcadeSession(match.session)).toBe(true);
  match.session.coinDeltas = [100, 100, 100, 100];
  expect(validArcadeSession(match.session)).toBe(false);
});
