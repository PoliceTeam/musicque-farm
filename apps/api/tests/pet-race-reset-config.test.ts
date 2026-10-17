import { expect, it } from 'vitest';
import { DEFAULT_PET_RACE_RESET, readConfig } from '@/config';
import { raceResetDay } from '@/modules/arcade/pet-racing/reset-policy';

it('reads defaults and explicit reset environment settings', () => {
  expect(readConfig({ DATABASE_URL: 'pglite:memory' }).petRaceReset).toEqual(DEFAULT_PET_RACE_RESET);
  expect(
    readConfig({
      DATABASE_URL: 'pglite:memory',
      PET_RACE_RESET_ENABLED: 'false',
      PET_RACE_RESET_TIME: '04:30',
      PET_RACE_RESET_TIMEZONE: 'UTC',
    }).petRaceReset,
  ).toEqual({ enabled: false, time: '04:30', timeZone: 'UTC' });
});

it('rejects invalid reset settings before starting the API', () => {
  for (const [key, values] of Object.entries({
    PET_RACE_RESET_ENABLED: ['yes', '1', ''],
    PET_RACE_RESET_TIME: ['4:30', '24:00', '12:60', ''],
    PET_RACE_RESET_TIMEZONE: ['invalid/zone', ''],
  })) {
    for (const value of values) expect(() => readConfig({ DATABASE_URL: 'pglite:memory', [key]: value })).toThrow(key);
  }
});

it('labels the scheduled day before and exactly at a custom local reset time', () => {
  const policy = { enabled: true, time: '04:30', timeZone: 'Asia/Ho_Chi_Minh' };
  expect(raceResetDay(Date.parse('2026-10-16T21:29:59.999Z'), policy)).toBe('2026-10-16');
  expect(raceResetDay(Date.parse('2026-10-16T21:30:00Z'), policy)).toBe('2026-10-17');
  expect(raceResetDay(Date.parse('2027-01-01T00:00:00Z'), { ...policy, timeZone: 'UTC' })).toBe('2026-12-31');
});

it('handles skipped and repeated local hours without inventing another reset day', () => {
  const policy = { enabled: true, time: '02:30', timeZone: 'America/New_York' };
  expect(raceResetDay(Date.parse('2026-03-08T06:59:59Z'), policy)).toBe('2026-03-07');
  expect(raceResetDay(Date.parse('2026-03-08T07:00:00Z'), policy)).toBe('2026-03-08');
  expect(raceResetDay(Date.parse('2026-11-01T05:30:00Z'), { ...policy, time: '01:30' })).toBe('2026-11-01');
  expect(raceResetDay(Date.parse('2026-11-01T06:30:00Z'), { ...policy, time: '01:30' })).toBe('2026-11-01');
});
