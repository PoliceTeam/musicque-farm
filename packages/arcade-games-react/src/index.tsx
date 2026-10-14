'use client';
import {
  bauCuaGame,
  chessGame,
  chineseChessGame,
  diamondsGame,
  phomGame,
  slotsGame,
  tienLenGame,
} from '@chibi-town/arcade-games';
import { createInstance } from 'i18next';
import { useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { DiamondsGame } from './_components/diamonds-game.js';
import { miniGameView } from './_components/mini-game.js';
import { PhomGame } from './_components/phom-game.js';
import { TienGame } from './_components/tien-game.js';
import type { ArcadeGameProps } from './_utils/arcade-game-props.js';
import { ArcadeHostProvider, useArcadeHost } from './host.js';
import { arcadeVi } from './locales/vi.js';
import type { ArcadeGameModule } from './registry.js';
export const diamondsGameModule: ArcadeGameModule = {
  id: diamondsGame.id,
  title: 'Kim cương',
  seats: 2,
  card: 'diamonds',
  engine: diamondsGame,
  View: DiamondsGame,
  messages: arcadeVi,

  bindSdk: (sdk) => ({
    ...sdk,

    getArcadeLobby: () => sdk.getArcadeLobby(),

    startDiamondRoom: (input) => sdk.startDiamondRoom(input),

    playDiamond: (input) => sdk.playDiamond(input),
  }),

  summary: async (sdk) => ({ label: 'Điểm cao nhất', value: (await sdk.getArcadeLobby()).bestScore }),
};
export const tienLenGameModule: ArcadeGameModule = {
  id: tienLenGame.id,
  title: 'Tiến lên',
  seats: 4,
  card: 'tien-len',
  engine: tienLenGame,
  View: TienGame,
  messages: arcadeVi,

  bindSdk: (sdk) => ({
    ...sdk,

    getTienLobby: () => sdk.getTienLobby(),

    startTienRoom: (input) => sdk.startTienRoom(input),

    playTien: (input) => sdk.playTien(input),
  }),

  summary: async (sdk) => ({ label: 'Số trận thắng', value: (await sdk.getTienLobby()).wins }),
};
export const phomGameModule: ArcadeGameModule = {
  id: 'phom',
  title: 'Phỏm',
  seats: 4,
  card: 'phom',
  engine: phomGame,
  View: PhomGame,
  messages: arcadeVi,

  bindSdk: (sdk) => ({
    ...sdk,

    getPhomLobby: () => sdk.getPhomLobby(),

    startPhomRoom: (input) => sdk.startPhomRoom(input),

    playPhom: (input) => sdk.playPhom(input),
  }),

  summary: async (sdk) => ({ label: 'Số trận thắng', value: (await sdk.getPhomLobby()).wins }),
};

const miniModule = (engine: typeof chessGame, title: string): ArcadeGameModule => ({
  id: engine.id,
  title,
  seats: engine.seats,
  card: engine.id,
  engine,
  View: miniGameView(engine.id),
  messages: arcadeVi,

  bindSdk: (sdk) => ({
    ...sdk,

    getMiniLobby: (gameId) => sdk.getMiniLobby(gameId),

    startMiniRoom: (input) => sdk.startMiniRoom(input),

    playMini: (input) => sdk.playMini(input),
  }),

  summary: async (sdk) => ({ label: 'Số trận thắng', value: (await sdk.getMiniLobby(engine.id)).wins }),
});

export const bauCuaGameModule = miniModule(bauCuaGame, 'Bầu cua'),
  slotsGameModule = miniModule(slotsGame, 'Slots'),
  chessGameModule = miniModule(chessGame, 'Cờ vua'),
  chineseChessGameModule = miniModule(chineseChessGame, 'Cờ tướng');

export function ArcadeGameMount({ game, ...props }: ArcadeGameProps & { game: ArcadeGameModule }) {
  const host = useArcadeHost();
  const bound = useMemo(() => ({ ...host, sdk: game.bindSdk(host.sdk) }), [game, host]);
  const locale = useMemo(() => {
    const instance = createInstance();
    void instance.init({
      lng: 'vi',
      fallbackLng: 'vi',
      defaultNS: 'common',
      initAsync: false,
      resources: { vi: { common: structuredClone(game.messages) } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    return instance;
  }, [game]);
  const View = game.View;
  return (
    <ArcadeHostProvider host={bound}>
      <I18nextProvider i18n={locale}>
        {game.css && <style>{game.css}</style>}
        <View {...props} />
      </I18nextProvider>
    </ArcadeHostProvider>
  );
}

export type { ArcadeGameProps } from './_utils/arcade-game-props.js';
export * from './host.js';
export * from './registry.js';
