import { ApiSdkError } from './index.js';

/** Persisted points. Level thresholds and stat caps belong to future gameplay rules. */
export type CharacterStats = {
  experience: number;
  fashion: number;
  friendliness: number;
  happiness: number;
  mischief: number;
  health: number;
};

export function decodeCharacterStats(value: unknown): CharacterStats {
  const stats = value as CharacterStats;
  if (
    !stats ||
    ['experience', 'fashion', 'friendliness', 'happiness', 'mischief', 'health'].some((key) => {
      const points = stats[key as keyof CharacterStats];
      return !Number.isSafeInteger(points) || points < 0 || (key !== 'experience' && points > 2147483647);
    })
  )
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid character stats response');
  return {
    experience: stats.experience,
    fashion: stats.fashion,
    friendliness: stats.friendliness,
    happiness: stats.happiness,
    mischief: stats.mischief,
    health: stats.health,
  };
}
