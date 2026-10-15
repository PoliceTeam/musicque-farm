import {
  createMiniMatch,
  isMiniGameId,
  miniCoinDelta,
  miniMemberCoinDeltas,
  miniSnapshot,
  playMiniAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { validMiniCommand, validMiniStart } from '@chibi-town/contracts/mini-games';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createMiniService(
  context: PracticeContext,
): Pick<GameService, 'getMiniLobby' | 'startMiniRoom' | 'playMini'> {
  const {
    randomSeed,
    lobbySource,
    localHostId,
    reservedCoins,
    prune,
    botAvailable,
    settle,
    sessionFor,
    checkStart,
    tableDirectory,
    mini,
  } = context;
  return {
    getMiniLobby(gameId) {
      if (!isMiniGameId(gameId)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = mini(document, gameId);
        return {
          gameId,
          source: lobbySource,
          wins: state.wins,
          availableCoins: document.farm.coins - reservedCoins(document),
          rooms: tableDirectory(gameId === 'bau-cua' || gameId === 'slots' ? 4 : 2, state.activeMatch),
          activeMatch: state.activeMatch ? miniSnapshot(state.activeMatch) : undefined,
        };
      };
    },

    startMiniRoom(input) {
      if (!validMiniStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = mini(document, input.gameId),
          fingerprint = JSON.stringify(input);
        const prior = Object.hasOwn(state.starts, input.requestId) ? state.starts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.match;
        }
        if (state.activeMatch && state.activeMatch.status !== 'finished') {
          if (state.activeMatch.roomId !== input.roomId || state.activeMatch.tableId !== (input.tableId ?? 0))
            throw new ApiSdkError('MATCH_IN_PROGRESS');
          return miniSnapshot(state.activeMatch);
        }
        state.activeMatch = createMiniMatch(
          input.gameId,
          input.requestId,
          input.roomId,
          randomSeed(),
          input.tableId ?? 0,
        );
        state.activeMatch.session = sessionFor(input.roomId, input.difficulty);
        if (input.gameId === 'bau-cua' || input.gameId === 'slots') {
          document.arcadeBotCoins ??= {};
          state.activeMatch.session.members = Array.from({ length: 4 }, (_, index) => {
            const id = index === 0 ? localHostId : `local-bot-${index}`;
            if (index > 0) document.arcadeBotCoins![id] ??= 10000;
            return {
              id,
              ready: index !== 0,
              stake: 0,
              choice: index % 6,
              coins: index === 0 ? document.farm.coins : document.arcadeBotCoins![id],
            };
          });
        }

        const match = miniSnapshot(state.activeMatch);
        state.starts[input.requestId] = { fingerprint, match };
        prune(state.starts, input.requestId);
        state.requests = {};
        return match;
      };
    },

    playMini(command) {
      if (!validMiniCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        const state = mini(document, command.gameId),
          fingerprint = JSON.stringify(command);
        const prior = Object.hasOwn(state.requests, command.requestId) ? state.requests[command.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.result;
        }
        const match = state.activeMatch;
        if (!match || match.id !== command.matchId) throw new ApiSdkError('MAP_NOT_FOUND');
        if (match.revision !== command.revision) throw new ApiSdkError('REQUEST_CONFLICT');
        if (
          command.action.type === 'start' ||
          (match.status === 'waiting' && ['roll', 'spin'].includes(command.action.type))
        )
          checkStart(document, match.session);
        const prepared = { ...structuredClone(match), seed: randomSeed() };
        if (
          ['start', 'roll', 'spin'].includes(command.action.type) &&
          prepared.session?.mode === 'wager' &&
          (command.gameId === 'bau-cua' || command.gameId === 'slots')
        ) {
          prepared.session.members = prepared.session.members?.map((member) => {
            if (member.id === localHostId) return member;
            const available = botAvailable(document, member.id, command.gameId);
            const stake = member.stake ?? prepared.session!.stake;
            return stake > available ||
              !Number.isSafeInteger(
                (document.arcadeBotCoins?.[member.id] ?? 10000) + stake * (command.gameId === 'slots' ? 9 : 3),
              )
              ? { ...member, stake: 0 }
              : member;
          });
        }
        let next: ReturnType<typeof playMiniAction>;
        try {
          next = playMiniAction(prepared, command.action);
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (['INVALID_TURN', 'INVALID_PLAY', 'MATCH_FINISHED'].includes(code))
            throw new ApiSdkError(code as 'INVALID_PLAY');
          throw error;
        }
        if (command.action.type === 'next-round' && next.state.session?.mode === 'wager') {
          document.arcadeBotCoins ??= {};
          next.state.session.members = next.state.session.members?.map((member) => {
            if (member.id !== localHostId && (document.arcadeBotCoins![member.id] ?? 10000) < 1)
              document.arcadeBotCoins![member.id] = 10000;
            return {
              ...member,
              coins: member.id === localHostId ? document.farm.coins : document.arcadeBotCoins![member.id],
            };
          });
        }
        if (next.state.status === 'finished') {
          const delta = miniCoinDelta(next.state);
          if (command.gameId === 'bau-cua' || command.gameId === 'slots') {
            document.arcadeBotCoins ??= {};
            const payouts = miniMemberCoinDeltas(next.state).map((p) => {
              const balance =
                p.memberId === localHostId ? document.farm.coins : (document.arcadeBotCoins![p.memberId] ?? 10000);
              const coinsAfter = balance + p.delta;
              if (!Number.isSafeInteger(coinsAfter) || coinsAfter < 0) throw new ApiSdkError('INSUFFICIENT_COINS');
              return { ...p, coinsAfter };
            });
            // Validate every balance before writing any member's settlement.
            for (const p of payouts) {
              if (p.memberId === localHostId) document.farm.coins = p.coinsAfter;
              else document.arcadeBotCoins[p.memberId] = p.coinsAfter;
            }
            next.state.session!.settled = true;
            next.state.session!.coinDelta = payouts.find((p) => p.memberId === localHostId)?.delta ?? delta;
            next.state.session!.housePayouts = payouts;
            next.state.session!.members = next.state.session!.members?.map((member) => ({
              ...member,
              coins: payouts.find((p) => p.memberId === member.id)?.coinsAfter ?? member.coins,
            }));
            document.revision++;
          } else settle(document, next.state, next.state.outcome === 'win', [delta, -delta, 0, 0]);
          if (match.status !== 'finished' && next.state.outcome === 'win') state.wins++;
        }
        next.result.match = miniSnapshot(next.state);
        state.activeMatch = next.state;
        state.requests[command.requestId] = { fingerprint, result: next.result };
        prune(state.requests, command.requestId);
        return next.result;
      };
    },
  };
}
