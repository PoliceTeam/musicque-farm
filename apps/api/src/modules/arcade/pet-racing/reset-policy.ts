import type { PetRaceResetConfig } from '@/config';

/** Label the most recent scheduled local reset, including calendars with DST. */
export function raceResetDay(now: number, policy: PetRaceResetConfig) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: policy.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;

  const day = `${part('year')}-${part('month')}-${part('day')}`;
  if (`${part('hour')}:${part('minute')}` >= policy.time) return day;
  // Subtract a calendar day, not 24 hours from the instant: DST days need not last 24 hours.
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}
