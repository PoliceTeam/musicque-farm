import { DEFAULT_RACE_CONFIG, type RaceResult, raceOdds } from '@chibi-town/contracts/pet-racing';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { RaceVictory } from '@/features/pet-racing/_components/race-victory';

const result: RaceResult = {
  requestId: 'confirmed-win',
  roundId: 'race-123',
  pet: 0,
  winner: 0,
  stake: 100,
  coinDelta: 275,
  odds: raceOdds(DEFAULT_RACE_CONFIG),
  startedAt: 30000,
  finishTimes: [10500, 12000, 13000, 14000, 14500, 12500],
};

function render(value: RaceResult, celebrate = true) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <RaceVictory result={value} celebrate={celebrate} />
    </I18nextProvider>,
  );
}

it('celebrates a settled win with the actual gross credit, without mistaking profit for payout', () => {
  const html = render(result);
  expect(html).toContain('Chúc mừng! Bạn thắng cược');
  expect(html).toContain('+375 xu đã cộng vào ví');
  expect(html).toContain('Corgi về nhất!');
  expect(html).toContain('pet-race-confetti');
  expect(html.match(/--confetti-x/g)).toHaveLength(36);
});

it('never celebrates a loss and omits particles when reviewing an old win', () => {
  expect(render({ ...result, winner: 1, coinDelta: -100 })).toBe('');
  expect(render(result, false)).not.toContain('pet-race-confetti');
  expect(render(result, false)).toContain('+375 xu đã cộng vào ví');
});
