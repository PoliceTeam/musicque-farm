import {
  createGemBattle,
  gemBattleSnapshot,
  gemPublicResult,
  playGemAction,
} from '@chibi-town/arcade-games/gem-battle-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { validDiamondCommand, validDiamondStart } from '@chibi-town/contracts/arcade';
import { ARCADE_GAMES } from '@chibi-town/game-content/arcade-catalog';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createDiamondService(
  context: PracticeContext,
): Pick<GameService, 'getArcadeLobby' | 'startDiamondRoom' | 'playDiamond'> {
  const { clock, lobbySource, reservedCoins, prune, settle, sessionFor, checkStart, tableDirectory, arcade } = context;
  return {
    getArcadeLobby() {
      return (document) => {
        const state = arcade(document);
        return {
          source: lobbySource,
          games: [...ARCADE_GAMES],
          bestScore: state.bestScore,
          availableCoins: document.farm.coins - reservedCoins(document),
          activeBattle: state.activeBattle ? gemBattleSnapshot(state.activeBattle) : undefined,
          rooms: tableDirectory(2, state.activeBattle),
        };
      };
    },

    startDiamondRoom(input) {
      if (!validDiamondStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = arcade(document);
        const fingerprint = JSON.stringify(input);
        const prior = Object.hasOwn(state.starts, input.requestId) ? state.starts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return gemBattleSnapshot(prior.battle);
        }
        if (state.activeBattle && ['waiting', 'playing'].includes(state.activeBattle.status)) {
          if (state.activeBattle.roomId === input.roomId && (state.activeBattle.tableId ?? 0) === (input.tableId ?? 0))
            return gemBattleSnapshot(state.activeBattle);
          throw new ApiSdkError('MATCH_IN_PROGRESS');
        }
        state.activeBattle = createGemBattle(
          input.requestId,
          input.roomId,
          (clock() + input.roomId * 10 + (input.tableId ?? 0)) >>> 0,
          input.tableId ?? 0,
        );
        state.activeBattle.session = sessionFor(input.roomId, input.difficulty);
        state.activeBattle.status = 'waiting';
        state.starts[input.requestId] = { fingerprint, battle: gemBattleSnapshot(state.activeBattle) };
        prune(state.starts, input.requestId);
        state.requests = {};
        return gemBattleSnapshot(state.activeBattle);
      };
    },

    playDiamond(command) {
      if (!validDiamondCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = arcade(document);
        const fingerprint = JSON.stringify(command);
        const prior = Object.hasOwn(state.requests, command.requestId) ? state.requests[command.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return gemPublicResult(prior.result);
        }
        const battle = state.activeBattle;
        if (!battle || battle.id !== command.battleId) throw new ApiSdkError('MAP_NOT_FOUND');
        if (battle.revision !== command.revision) throw new ApiSdkError('REQUEST_CONFLICT');
        if (command.action.type === 'start') checkStart(document, battle.session);
        let result: ReturnType<typeof playGemAction>;
        try {
          result = playGemAction(battle, command.action);
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (['INVALID_MOVE', 'NO_MATCH', 'NOT_ENOUGH_MANA', 'MATCH_FINISHED', 'INVALID_TURN'].includes(code))
            throw new ApiSdkError(code as 'INVALID_MOVE' | 'NO_MATCH' | 'NOT_ENOUGH_MANA' | 'MATCH_FINISHED');
          throw error;
        }
        if (['won', 'lost'].includes(result.battle.status))
          settle(document, result.battle, result.battle.status === 'won');
        state.activeBattle = result.battle;
        state.bestScore = Math.max(state.bestScore, result.battle.score);
        const publicResult = gemPublicResult(result);
        state.requests[command.requestId] = { fingerprint, result: publicResult };
        prune(state.requests, command.requestId);
        return publicResult;
      };
    },
  };
}
