import { createPhomMatch, phomSnapshot, playPhomAction } from '@chibi-town/arcade-games/phom-logic';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import { ApiSdkError } from '@chibi-town/contracts';
import { validPhomCommand } from '@chibi-town/contracts/phom';
import { validTienStart } from '@chibi-town/contracts/tien-len';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createPhomService(
  context: PracticeContext,
): Pick<GameService, 'getPhomLobby' | 'startPhomRoom' | 'playPhom'> {
  const { randomSeed, lobbySource, reservedCoins, prune, settle, sessionFor, checkStart, tableDirectory, phom } =
    context;
  return {
    getPhomLobby() {
      return (document) => {
        const state = phom(document);
        return {
          source: lobbySource,
          wins: state.wins,
          availableCoins: document.farm.coins - reservedCoins(document),
          activeMatch: state.activeMatch ? phomSnapshot(state.activeMatch) : undefined,
          rooms: tableDirectory(4, state.activeMatch),
        };
      };
    },

    startPhomRoom(input) {
      if (!validTienStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = phom(document),
          fingerprint = JSON.stringify(input);
        const prior = Object.hasOwn(state.starts, input.requestId) ? state.starts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.match;
        }
        if (state.activeMatch && state.activeMatch.status !== 'finished') {
          if (state.activeMatch.roomId !== input.roomId || (state.activeMatch.tableId ?? 0) !== (input.tableId ?? 0))
            throw new ApiSdkError('MATCH_IN_PROGRESS');
          return phomSnapshot(state.activeMatch);
        }
        state.activeMatch = createPhomMatch(input.requestId, input.roomId, randomSeed(), input.tableId ?? 0);
        state.activeMatch.session = sessionFor(input.roomId, input.difficulty);
        state.activeMatch.session.payoutRule = 'ranked-pool';
        state.activeMatch.session.playerCount = 4;
        const match = phomSnapshot(state.activeMatch);
        state.starts[input.requestId] = { fingerprint, match };
        prune(state.starts, input.requestId);
        state.requests = {};
        return match;
      };
    },

    playPhom(command) {
      if (!validPhomCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = phom(document),
          fingerprint = JSON.stringify(command);
        const prior = Object.hasOwn(state.requests, command.requestId) ? state.requests[command.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.result;
        }
        const match = state.activeMatch;
        if (!match || match.id !== command.matchId) throw new ApiSdkError('MAP_NOT_FOUND');
        if (match.revision !== command.revision) throw new ApiSdkError('REQUEST_CONFLICT');
        if (command.action.type === 'start') checkStart(document, match.session);
        let next: ReturnType<typeof playPhomAction>;
        try {
          next = playPhomAction({ ...match, seed: randomSeed() }, command.action);
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (['INVALID_TURN', 'INVALID_PLAY', 'MATCH_FINISHED'].includes(code))
            throw new ApiSdkError(code as 'INVALID_PLAY');
          throw error;
        }
        if (next.state.status === 'finished') {
          const places = next.state.placements;
          const deltas =
            next.state.session?.payoutRule && places && places.length >= 2
              ? topTwoPayout(next.state.session.stake, places[0], places[1], next.state.session.playerCount ?? 4)
              : undefined;
          settle(document, next.state, next.state.winner === 0, deltas);
        }
        next.result.match = phomSnapshot(next.state);
        state.activeMatch = next.state;
        if (next.state.status === 'finished' && match.status !== 'finished' && next.state.winner === 0) state.wins++;
        state.requests[command.requestId] = { fingerprint, result: next.result };
        prune(state.requests, command.requestId);
        return next.result;
      };
    },
  };
}
