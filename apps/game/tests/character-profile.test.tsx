import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { CharacterProfile } from '@/features/character/_components/character-profile';

it('renders account values and display name without inventing progress percentages or exposing the username', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <CharacterProfile
        player={{
          id: 'me',
          name: 'Tên hiển thị',
          username: 'private_username',
          level: 9,
          outfit: defaultOutfit,
          stats: { experience: 1234, fashion: 7, friendliness: 13, happiness: 21, mischief: 3, health: 100 },
        }}
        coins={29115}
        gems={0}
      />
    </I18nextProvider>,
  );
  expect(html).toContain('Tên hiển thị');
  expect(html).toContain('Cấp 9');
  expect(html).toContain('29.115');
  expect(html).toContain('<dd>1.234</dd>');
  expect(html).toContain('<dd>100</dd>');
  expect(html).toContain('Thân thiện');
  expect(html).not.toContain('private_username');
  expect(html).not.toContain('role="progressbar"');
});

it('keeps unavailable account values distinct from actual zero points', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <CharacterProfile />
    </I18nextProvider>,
  );
  expect(html.match(/<dd>…<\/dd>/g)).toHaveLength(8);
  expect(html).not.toContain('<dd>0</dd>');
});
