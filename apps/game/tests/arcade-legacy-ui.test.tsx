import { createGameSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import { ArcadeHostProvider } from '@chibi-town/arcade-games-react';
import { TableSettings } from '@chibi-town/arcade-games-react/table-settings';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';

const host = {
  sdk: createGameSdk({ adapter: 'local', repository: createMemoryRepository() }),
  assets: {},

  Avatar: () => null,

  navigate: () => {},
};
it('explains why a resumed legacy match has no wager setup and how to leave it free', () => {
  const html = renderToStaticMarkup(
    <ArcadeHostProvider host={host}>
      <I18nextProvider i18n={createGameI18n()}>
        <TableSettings
          gameId="diamonds"
          match={{ id: 'legacy', revision: 16, status: 'playing' }}
          playerId="local-player"
          name="Bé Chibi"
          coins={1000}
          changed={async () => {}}
        />
      </I18nextProvider>
    </ArcadeHostProvider>,
  );
  expect(html).toContain('Ván đang lưu từ bản cũ');
  expect(html).toContain('rời ván cũ miễn phí');
  expect(html).not.toContain('type="number"');
});
it('shows host controls and an affordable xu limit for a new waiting wager table', () => {
  const html = renderToStaticMarkup(
    <ArcadeHostProvider host={host}>
      <I18nextProvider i18n={createGameI18n()}>
        <TableSettings
          gameId="diamonds"
          match={{
            id: 'new',
            revision: 0,
            status: 'waiting',
            session: { hostId: 'local-player', mode: 'wager', stake: 0, difficulty: 'medium', configured: false },
          }}
          playerId="local-player"
          name="Bé Chibi"
          coins={1000}
          changed={async () => {}}
        />
      </I18nextProvider>
    </ArcadeHostProvider>,
  );
  expect(html).toContain('Chủ bàn: Bé Chibi');
  expect(html).toContain('max="1000"');
  expect(html).toContain('Số xu cược');
  expect(html).toContain('Áp dụng mức cược');
  expect(html).toContain('Kích khỏi bàn');
});

it('practice shows only setup and start, without bot readiness or member management', () => {
  const html = renderToStaticMarkup(
    <ArcadeHostProvider host={host}>
      <I18nextProvider i18n={createGameI18n()}>
        <TableSettings
          gameId="tien-len"
          match={{
            id: 'practice',
            revision: 0,
            status: 'waiting',
            session: { hostId: 'local-player', mode: 'practice', stake: 0, difficulty: 'medium', configured: false },
          }}
          playerId="local-player"
          name="Bé Chibi"
          coins={1000}
          changed={async () => {}}
          onStart={async () => {}}
        />
      </I18nextProvider>
    </ArcadeHostProvider>,
  );
  expect(html).toContain('Số người');
  expect(html).toContain('Độ khó');
  expect(html).toContain('Bắt đầu');
  expect(html).not.toContain('Sẵn sàng');
  expect(html).not.toContain('arcade-members');
  expect(html).not.toContain('Kích khỏi bàn');
});
