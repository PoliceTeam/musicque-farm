import { RACE_COUNTDOWN, type RaceOdds, type RaceResult, type RaceRound } from '@chibi-town/contracts/pet-racing';

/** The server's finish times determine the order; variation only animates each lane. */
export function raceProgress(
  race: Pick<RaceResult, 'finishTimes'>,
  lane: number,
  elapsed: number,
  reducedMotion = false,
) {
  if (reducedMotion) return elapsed >= race.finishTimes[lane] ? 1 : 0;
  const p = Math.max(0, Math.min(1, elapsed / race.finishTimes[lane]));
  return Math.max(0, Math.min(1, p + Math.sin(p * Math.PI) * Math.sin(p * 12 + lane * 2) * 0.025));
}

/** Rounded labels are approximate; payouts always use the exact rational terms. */
export function raceMultiplierLabel(odds: RaceOdds) {
  const multiplier = odds.payoutNumerator / odds.payoutDenominator;
  const rounded = Math.round(multiplier * 100) / 100;
  return `${rounded === multiplier ? '' : '≈'}×${rounded.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}`;
}

/** Refresh once at a phase deadline; a push may arrive earlier and reschedule this safety net. */
export function nextRaceRefreshDelay(round: RaceRound, now: number) {
  const end =
    round.phase === 'betting'
      ? round.startsAt
      : round.phase === 'countdown'
        ? round.startsAt + RACE_COUNTDOWN
        : round.phase === 'racing'
          ? round.endsAt
          : round.nextRoundAt;
  return Math.max(100, end - now + 100);
}

/** Credit comes from the server's settled delta, including the original stake already debited. */
export function raceSettlementAmounts(result: Pick<RaceResult, 'stake' | 'coinDelta'>) {
  return { debited: result.stake, credited: result.stake + result.coinDelta, net: result.coinDelta };
}
