import { isMiniGameId } from '@chibi-town/arcade-games/mini-games-logic';
import { arcadeMembers } from '@chibi-town/arcade-games/session';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import { ApiSdkError } from '@chibi-town/contracts';
import { validArcadeSettings } from '@chibi-town/contracts/arcade-table';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createSettingsService(context: PracticeContext): Pick<GameService, 'configureArcadeTable'> {
  const { localHostId, reservedCoins, prune, botAvailable } = context;
  return {
    configureArcadeTable(input) {
      if (!validArcadeSettings(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        document.arcadeTableRequests ??= {};
        const records = document.arcadeTableRequests;
        const fingerprint = JSON.stringify({ type: 'configure', ...input });
        const prior = Object.hasOwn(records, input.requestId) ? records[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return prior.result;
        }
        const match =
          input.gameId === 'diamonds'
            ? document.arcade?.activeBattle
            : input.gameId === 'phom'
              ? document.phom?.activeMatch
              : isMiniGameId(input.gameId)
                ? document.mini?.[input.gameId]?.activeMatch
                : document.tien?.activeMatch;
        if (!match || match.id !== input.matchId) throw new ApiSdkError('MAP_NOT_FOUND');
        if (match.revision !== input.revision) throw new ApiSdkError('REQUEST_CONFLICT');
        if (match.status !== 'waiting') throw new ApiSdkError('MATCH_IN_PROGRESS');
        if (match.session?.hostId !== localHostId) throw new ApiSdkError('NOT_ALLOWED');
        if (
          match.session.mode === 'practice'
            ? input.stake !== 0
            : input.stake < 1 || input.stake > document.farm.coins - reservedCoins(document)
        )
          throw new ApiSdkError('INSUFFICIENT_COINS');
        if (
          ['tien-len', 'phom'].includes(input.gameId) &&
          match.session.payoutRule &&
          (input.stake > Math.floor(Number.MAX_SAFE_INTEGER / 4) ||
            !Number.isSafeInteger(
              document.farm.coins +
                topTwoPayout(input.stake, 0, 1, input.playerCount ?? match.session.playerCount ?? 4)[0],
            ))
        )
          throw new ApiSdkError('INSUFFICIENT_COINS');
        if (input.gameId === 'diamonds' && !Number.isSafeInteger(document.farm.coins + input.stake))
          throw new ApiSdkError('INSUFFICIENT_COINS');
        if (isMiniGameId(input.gameId)) {
          const maxWin = input.gameId === 'slots' ? 9 : input.gameId === 'bau-cua' ? 3 : 1;
          if (
            input.stake > Math.floor(Number.MAX_SAFE_INTEGER / 10) ||
            !Number.isSafeInteger(document.farm.coins + input.stake * maxWin)
          )
            throw new ApiSdkError('INSUFFICIENT_COINS');
        }
        match.session.members = arcadeMembers(match.session).map((m) => ({
          ...m,
          ready: match.session!.mode === 'practice' || m.id === localHostId ? true : m.ready,
        }));
        if (input.playerCount && input.playerCount !== match.session.members.length) {
          match.session.members = Array.from({ length: input.playerCount }, (_, index) => ({
            id: index === 0 ? localHostId : `local-bot-${index}`,
            ready: true,
          }));
        }
        if (input.gameId === 'bau-cua') document.mini!['bau-cua']!.activeMatch!.choice = input.choice ?? 0;
        if (input.gameId === 'bau-cua' || input.gameId === 'slots') {
          if (input.bets?.some((b) => !match.session!.members!.some((m) => m.id === b.memberId)))
            throw new ApiSdkError('INVALID_COMMAND');
          document.arcadeBotCoins ??= {};
          match.session.members = match.session.members!.map((member, index) => {
            const bet = input.bets?.find((b) => b.memberId === member.id);
            const balance =
              member.id === localHostId
                ? document.farm.coins - reservedCoins(document)
                : botAvailable(document, member.id, input.gameId);
            const stake =
              match.session!.mode === 'practice'
                ? 0
                : member.id === localHostId
                  ? input.stake
                  : (bet?.stake ?? Math.min(balance, input.stake));
            if (
              stake > balance ||
              (match.session!.mode === 'wager' && stake < 1 && (member.id === localHostId || bet !== undefined)) ||
              stake > Math.floor(Number.MAX_SAFE_INTEGER / 10) ||
              !Number.isSafeInteger(balance + stake * (input.gameId === 'slots' ? 9 : 3))
            )
              throw new ApiSdkError('INSUFFICIENT_COINS');
            return {
              ...member,
              ready: member.id === localHostId ? true : member.ready,
              stake,
              choice: member.id === localHostId ? (input.choice ?? 0) : (bet?.choice ?? member.choice ?? index % 6),
              coins: balance,
            };
          });
        }
        match.session.configured = true;
        match.session.stake = input.stake;
        match.session.difficulty = input.difficulty;
        if (['tien-len', 'phom'].includes(input.gameId)) {
          match.session.playerCount = input.playerCount ?? match.session.playerCount ?? 4;
          match.session.payoutRule = 'ranked-pool';
        }
        match.revision++;
        const result = { coins: document.farm.coins, coinDelta: 0, session: { ...match.session } };
        records[input.requestId] = { fingerprint, result };
        prune(records, input.requestId);
        return result;
      };
    },
  };
}
