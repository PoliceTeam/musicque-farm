/** Equal contributions: 2 seats winner takes all; 3 seats 80/20; 4 seats 60/40. No house fee. */
export function topTwoPayout(stake: number, first: number, second: number, playerCount = 4): number[] {
  if (
    !Number.isSafeInteger(stake) ||
    stake < 0 ||
    ![2, 3, 4].includes(playerCount) ||
    stake > Math.floor(Number.MAX_SAFE_INTEGER / playerCount) ||
    ![first, second].every((seat) => Number.isInteger(seat) && seat >= 0 && seat < playerCount) ||
    first === second
  )
    throw new Error('INVALID_PAYOUT');
  const pool = stake * playerCount;
  const numerator = playerCount === 2 ? 5 : playerCount === 3 ? 4 : 3;
  const firstShare = Math.floor(pool / 5) * numerator + Math.floor(((pool % 5) * numerator) / 5);
  const deltas = Array.from({ length: 4 }, (_, seat) => (seat < playerCount ? -stake : 0));
  deltas[first] += firstShare;
  deltas[second] += pool - firstShare;
  return deltas;
}
