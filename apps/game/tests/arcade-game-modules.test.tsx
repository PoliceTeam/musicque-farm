import { createGameSdk, createMemoryRepository } from '@chibi-town/api-sdk';
import {
  type ArcadeGameModule,
  ArcadeGameMount,
  ArcadeHostProvider,
  bauCuaGameModule,
  chessGameModule,
  chineseChessGameModule,
  createArcadeGameRegistry,
  diamondsGameModule,
  phomGameModule,
  slotsGameModule,
  tienLenGameModule,
  useArcadeHost,
} from '@chibi-town/arcade-games-react';
import type { createGameAudio } from '@chibi-town/game-audio';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';

const sdk = createGameSdk({ adapter: 'local', repository: createMemoryRepository() });
const bound = { ...sdk };

function NewGame() {
  const { t } = useTranslation('common');
  return (
    <section>
      <h1>{t('arcadeTitle')}</h1>
      <p>{useArcadeHost().sdk === bound ? 'Module SDK bound' : 'Wrong SDK'}</p>
    </section>
  );
}

it('registers a new ID with its own UI, locale and SDK adapter, independently of the fixed SDK catalog', async () => {
  const appLocale = createGameI18n();
  const game: ArcadeGameModule = {
    id: 'new-game-not-in-sdk-catalog',
    title: 'Game mới',
    seats: 2,
    card: '/new.webp',
    View: NewGame,
    messages: { arcadeTitle: 'Tiêu đề riêng của module' },

    bindSdk: () => bound,
  };
  const registry = createArcadeGameRegistry();
  registry.register(game);
  expect(registry.list().map((entry) => entry.id)).toEqual([game.id]);
  expect((await sdk.getArcadeLobby()).games.some((entry) => entry.id === (game.id as string))).toBe(false);
  const html = renderToStaticMarkup(
    <ArcadeHostProvider
      host={{
        sdk,
        assets: {},

        Avatar: () => null,

        navigate: () => {},
      }}
    >
      <ArcadeGameMount
        game={registry.get(game.id)!}
        player={await sdk.getPlayer()}
        coins={1000}
        audio={
          {
            unlock: async () => {},

            play: () => {},

            setMusic: () => {},

            subscribe: () => () => {},

            enabled: false,
            volumes: { music: 0, effects: 0 },

            setVolume: () => {},

            toggle: () => {},

            destroy: () => {},
          } satisfies ReturnType<typeof createGameAudio>
        }
        back={() => {}}
        refreshWallet={async () => {}}
      />
    </ArcadeHostProvider>,
  );
  expect(html).toContain('Tiêu đề riêng của module');
  expect(html).toContain('Module SDK bound');
  expect(appLocale.t('arcadeTitle')).toBe('Khu GAME');
  expect(() => registry.register(game)).toThrow('already registered');
});
it('bundles all seven games with their engine, view, adapter and summary', async () => {
  const registry = createArcadeGameRegistry();
  registry.register(diamondsGameModule);
  registry.register(tienLenGameModule);
  registry.register(phomGameModule);
  for (const module of [bauCuaGameModule, slotsGameModule, chessGameModule, chineseChessGameModule])
    registry.register(module);
  expect(registry.list().map((entry) => entry.id)).toEqual([
    'diamonds',
    'tien-len',
    'phom',
    'bau-cua',
    'slots',
    'chess',
    'chinese-chess',
  ]);
  for (const game of registry.list()) {
    expect(game.engine).toBeDefined();
    expect(game.View).toBeTypeOf('function');
    expect(game.messages.arcadeTitle).toBe('Khu GAME');
    expect(await game.summary!(game.bindSdk(sdk))).toMatchObject({ value: 0 });
  }
});
