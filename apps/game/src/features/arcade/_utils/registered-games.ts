import {
  bauCuaGameModule,
  chessGameModule,
  chineseChessGameModule,
  createArcadeGameRegistry,
  diamondsGameModule,
  phomGameModule,
  slotsGameModule,
  tienLenGameModule,
} from '@chibi-town/arcade-games-react';
export const arcadeGames = createArcadeGameRegistry();
arcadeGames.register(diamondsGameModule);
arcadeGames.register(tienLenGameModule);

arcadeGames.register(phomGameModule);

arcadeGames.register(bauCuaGameModule);
arcadeGames.register(slotsGameModule);
arcadeGames.register(chessGameModule);
arcadeGames.register(chineseChessGameModule);
