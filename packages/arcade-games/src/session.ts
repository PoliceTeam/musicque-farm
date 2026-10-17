export type ArcadeMember = { id: string; ready: boolean; stake?: number; choice?: number; coins?: number };
export type ArcadeHousePayout = { memberId: string; delta: number; coinsAfter: number };
export type ArcadeDifficulty = 'easy' | 'medium' | 'hard';
export type ArcadeSession = {
  hostId: string;
  members?: ArcadeMember[];
  housePayouts?: ArcadeHousePayout[];
  mode: 'casual' | 'wager' | 'practice';
  stake: number;
  difficulty: ArcadeDifficulty;
  configured?: boolean;
  settled?: boolean;
  coinDelta?: number;
  payoutRule?: 'top-two-60-40' | 'ranked-pool';
  coinDeltas?: number[];
  settlement?: 'house';
  playerCount?: 2 | 3 | 4;
};

export function validArcadeSession(value: unknown): value is ArcadeSession {
  const s = value as ArcadeSession;
  return (
    !!s &&
    typeof s.hostId === 'string' &&
    s.hostId.length > 0 &&
    s.hostId.length <= 100 &&
    (s.members === undefined ||
      (Array.isArray(s.members) &&
        s.members.length >= 1 &&
        s.members.length <= 4 &&
        new Set(s.members.map((m) => m.id)).size === s.members.length &&
        s.members[0].id === s.hostId &&
        s.members.every(
          (m) =>
            typeof m.id === 'string' &&
            m.id.length > 0 &&
            m.id.length <= 100 &&
            typeof m.ready === 'boolean' &&
            (m.stake === undefined || (Number.isSafeInteger(m.stake) && m.stake >= 0)) &&
            (m.coins === undefined || (Number.isSafeInteger(m.coins) && m.coins >= 0)) &&
            (m.choice === undefined || (Number.isInteger(m.choice) && m.choice >= 0 && m.choice < 6)),
        ))) &&
    ['casual', 'wager', 'practice'].includes(s.mode) &&
    Number.isSafeInteger(s.stake) &&
    s.stake >= 0 &&
    (s.mode === 'wager' || s.stake === 0) &&
    ['easy', 'medium', 'hard'].includes(s.difficulty) &&
    (s.configured === undefined || typeof s.configured === 'boolean') &&
    (s.settled === undefined || typeof s.settled === 'boolean') &&
    (s.coinDelta === undefined || Number.isSafeInteger(s.coinDelta)) &&
    (s.playerCount === undefined || [2, 3, 4].includes(s.playerCount)) &&
    (s.payoutRule === undefined ||
      (['top-two-60-40', 'ranked-pool'].includes(s.payoutRule) &&
        s.stake <= Math.floor(Number.MAX_SAFE_INTEGER / 4))) &&
    (s.housePayouts === undefined ||
      (Array.isArray(s.housePayouts) &&
        s.housePayouts.length <= 4 &&
        new Set(s.housePayouts.map((p) => p.memberId)).size === s.housePayouts.length &&
        s.housePayouts.every(
          (p) =>
            typeof p.memberId === 'string' &&
            p.memberId.length > 0 &&
            Number.isSafeInteger(p.delta) &&
            Number.isSafeInteger(p.coinsAfter) &&
            p.coinsAfter >= 0,
        ))) &&
    (s.settlement === undefined || s.settlement === 'house') &&
    (s.coinDeltas === undefined ||
      (Array.isArray(s.coinDeltas) &&
        s.coinDeltas.length === 4 &&
        s.coinDeltas.every(Number.isSafeInteger) &&
        (s.settlement === 'house' || s.coinDeltas.reduce((a, b) => a + b, 0) === 0)))
  );
}

export function arcadeMembers(session: ArcadeSession, count = session.playerCount ?? 2): ArcadeMember[] {
  return (
    session.members ??
    Array.from({ length: count }, (_, index) => ({
      id: index === 0 ? session.hostId : `local-bot-${index}`,
      ready: index === 0 ? !!session.configured : true,
    }))
  );
}

export function arcadeAllReady(session: ArcadeSession) {
  const members = arcadeMembers(session);
  return members.length >= 2 && members.every((m) => m.id === session.hostId || m.ready);
}
