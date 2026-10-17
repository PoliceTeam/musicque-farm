import { DEFAULT_RACE_CONFIG, type RaceResult, raceOdds } from '@chibi-town/contracts/pet-racing';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { RaceBetSummary } from '@/features/pet-racing/_components/race-bet-summary';
import { RaceSettlementSummary } from '@/features/pet-racing/_components/race-settlement-summary';

const odds = raceOdds(DEFAULT_RACE_CONFIG);
const result: RaceResult = {
  requestId: 'paid',
  roundId: 'race-123',
  pet: 0,
  stake: 100,
  odds,
  startedAt: 30000,
  winner: 0,
  finishTimes: [10500, 12000, 13000, 14000, 14500, 12500],
  coinDelta: 275,
};

it('keeps the confirmed pet, lane, actual debit and exact potential credit visible outside the bet dialog', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <RaceBetSummary bet={{ ...result, pet: 1 }} odds={odds[1]} />
    </I18nextProvider>,
  );
  expect(html).toContain('Đã cược Mèo trắng · Làn 2');
  expect(html).toContain('Đã trừ: 100 xu');
  expect(html).toContain('Thắng nhận: 409 xu');
});

it.each([
  { name: 'win', coinDelta: 275, winner: 0, credit: '+375 xu', net: '+275 xu', label: 'Thắng cược' },
  { name: 'loss', coinDelta: -100, winner: 1, credit: '0 xu', net: '−100 xu', label: 'Thua cược' },
])('distinguishes stake debit, gross credit and net result for a $name, even for a previous round', (entry) => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <RaceSettlementSummary result={{ ...result, coinDelta: entry.coinDelta, winner: entry.winner }} />
    </I18nextProvider>,
  );
  for (const text of [
    entry.label,
    'Vòng #123 · Corgi',
    'Vốn đã trừ',
    '−100 xu',
    'Thưởng đã cộng',
    entry.credit,
    'Lãi / lỗ',
    entry.net,
  ])
    expect(html).toContain(text);
});
