import { ApiSdkError } from '@chibi-town/contracts';
import { type DiamondCommand, validDiamondStart } from '@chibi-town/contracts/arcade';
import type { ArcadeTableStart } from '@chibi-town/contracts/arcade-table';
import { type MiniCommand, type MiniStart, validMiniStart } from '@chibi-town/contracts/mini-games';
import type { PhomCommand } from '@chibi-town/contracts/phom';
import { type TienCommand, validTienStart } from '@chibi-town/contracts/tien-len';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { GameService } from '@chibi-town/game-service';

export type ArcadeStart = ArcadeTableStart & { gameId?: MiniStart['gameId'] };
export type ArcadePlay = DiamondCommand | TienCommand | PhomCommand | MiniCommand;

export function validateStart(gameId: ArcadeGameId, input: ArcadeStart) {
  const valid =
    gameId === 'diamonds'
      ? validDiamondStart(input)
      : gameId === 'tien-len' || gameId === 'phom'
        ? validTienStart(input)
        : validMiniStart(input as MiniStart) && input.gameId === gameId;
  if (!valid) throw new ApiSdkError('INVALID_COMMAND');
}

export function practiceLobby(rules: GameService, gameId: ArcadeGameId) {
  switch (gameId) {
    case 'diamonds':
      return rules.getArcadeLobby();
    case 'tien-len':
      return rules.getTienLobby();
    case 'phom':
      return rules.getPhomLobby();
    default:
      return rules.getMiniLobby(gameId);
  }
}

export function startPractice(rules: GameService, gameId: ArcadeGameId, input: ArcadeStart) {
  switch (gameId) {
    case 'diamonds':
      return rules.startDiamondRoom(input);
    case 'tien-len':
      return rules.startTienRoom(input);
    case 'phom':
      return rules.startPhomRoom(input);
    default:
      return rules.startMiniRoom(input as MiniStart);
  }
}

/** Shared rules validate the exact game's command before returning its document operation. */
export function playPractice(rules: GameService, gameId: ArcadeGameId, input: ArcadePlay) {
  switch (gameId) {
    case 'diamonds':
      return rules.playDiamond(input as DiamondCommand);
    case 'tien-len':
      return rules.playTien(input as TienCommand);
    case 'phom':
      return rules.playPhom(input as PhomCommand);
    default:
      return rules.playMini(input as MiniCommand);
  }
}

export function matchIdOf(gameId: ArcadeGameId, input: ArcadePlay) {
  return gameId === 'diamonds' ? (input as DiamondCommand)?.battleId : (input as TienCommand)?.matchId;
}
