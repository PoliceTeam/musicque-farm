import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import { createTienMatch, playTienAction, tienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { validTienCommand, validTienStart } from '@chibi-town/contracts/tien-len';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createTienService(
  context: PracticeContext,
): Pick<GameService, 'getTienLobby' | 'startTienRoom' | 'playTien'> {
  const { clock, lobbySource, reservedCoins, prune, settle, sessionFor, checkStart, tableDirectory, tien } = context;
  return {
    getTienLobby() {
      return (document) => {
        const state = tien(document);
        return {
          source: lobbySource,
          wins: state.wins,
          availableCoins: document.farm.coins - reservedCoins(document),
          activeMatch: state.activeMatch ? tienSnapshot(state.activeMatch) : undefined,
          rooms: tableDirectory(4, state.activeMatch),
        };
      };
    },

    startTienRoom(input) {
      if (!validTienStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = tien(document),
          fingerprint = JSON.stringify(input);
        const prior = Object.hasOwn(state.starts, input.requestId) ? state.starts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.match;
        }
        if (state.activeMatch && state.activeMatch.status !== 'finished') {
          if (state.activeMatch.roomId !== input.roomId || (state.activeMatch.tableId ?? 0) !== (input.tableId ?? 0))
            throw new ApiSdkError('MATCH_IN_PROGRESS');
          return tienSnapshot(state.activeMatch);
        }
        state.activeMatch = createTienMatch(input.requestId, input.roomId, clock(), input.tableId ?? 0);
        state.activeMatch.session = sessionFor(input.roomId, input.difficulty);
        state.activeMatch.session.payoutRule = 'ranked-pool';
        state.activeMatch.session.playerCount = 4;
        const match = tienSnapshot(state.activeMatch);
        state.starts[input.requestId] = { fingerprint, match };
        prune(state.starts, input.requestId);
        state.requests = {};
        return match;
      };
    },

    playTien(command) {
      if (!validTienCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = tien(document),
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
        let next: ReturnType<typeof playTienAction>;
        try {
          next = playTienAction(match, command.action);
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (['INVALID_TURN', 'INVALID_PLAY', 'CANNOT_PASS', 'MATCH_FINISHED'].includes(code))
            throw new ApiSdkError(code as 'INVALID_PLAY');
          throw error;
        }
        if (next.state.status === 'finished') {
          const places = next.state.placements;
          const deltas =
            next.state.session?.payoutRule && places?.length === 2
              ? topTwoPayout(next.state.session.stake, places[0], places[1], next.state.session.playerCount ?? 4)
              : undefined;
          settle(document, next.state, next.state.winner === 0, deltas);
        }
        next.result.match = tienSnapshot(next.state);
        state.activeMatch = next.state;
        if (next.state.status === 'finished' && match.status !== 'finished' && next.state.winner === 0) state.wins++;
        state.requests[command.requestId] = { fingerprint, result: next.result };
        prune(state.requests, command.requestId);
        return next.result;
      };
    },
  };
}
