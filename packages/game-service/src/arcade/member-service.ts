import { isMiniGameId } from '@chibi-town/arcade-games/mini-games-logic';
import { arcadeMembers } from '@chibi-town/arcade-games/session';
import { ApiSdkError } from '@chibi-town/contracts';
import { validArcadeMemberCommand, validArcadeTableCommand } from '@chibi-town/contracts/arcade-table';
import type { GameService } from '../service-types.js';
import type { PracticeContext } from './practice-context.js';

export function createMemberService(
  context: PracticeContext,
): Pick<GameService, 'updateArcadeMember' | 'leaveArcadeTable'> {
  const { localHostId, prune, settle } = context;
  return {
    updateArcadeMember(input) {
      if (!validArcadeMemberCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        document.arcadeTableRequests ??= {};
        const records = document.arcadeTableRequests;
        const fingerprint = JSON.stringify({ type: 'member', ...input });
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
        if (!match.session || match.session.hostId !== localHostId) throw new ApiSdkError('NOT_ALLOWED');
        const members = arcadeMembers(match.session);
        if (input.action.type === 'kick') {
          const id = input.action.memberId;
          if (id === localHostId || !members.some((m) => m.id === id)) throw new ApiSdkError('NOT_ALLOWED');
          match.session.members = members.filter((m) => m.id !== id);
          if (['tien-len', 'phom'].includes(input.gameId))
            match.session.playerCount = Math.max(2, match.session.members.length) as 2 | 3 | 4;
        } else if (input.action.type === 'invite-bot') {
          const capacity = ['tien-len', 'phom', 'bau-cua', 'slots'].includes(input.gameId) ? 4 : 2;
          if (members.length >= capacity) throw new ApiSdkError('NOT_ALLOWED');
          const id = [1, 2, 3].map((n) => `local-bot-${n}`).find((id) => !members.some((m) => m.id === id))!;
          match.session.members = [...members, { id, ready: true }];
          if (['tien-len', 'phom'].includes(input.gameId))
            match.session.playerCount = match.session.members.length as 2 | 3 | 4;
        } else {
          const ready = input.action.ready;
          const memberId = input.action.memberId ?? localHostId;
          if (!members.some((m) => m.id === memberId)) throw new ApiSdkError('NOT_ALLOWED');
          if (ready && !match.session.configured) throw new ApiSdkError('NOT_ALLOWED');
          match.session.members = members.map((m) => (m.id === memberId ? { ...m, ready } : m));
        }
        match.revision++;
        const result = { coins: document.farm.coins, coinDelta: 0, session: { ...match.session } };
        records[input.requestId] = { fingerprint, result };
        prune(records, input.requestId);
        return result;
      };
    },

    leaveArcadeTable(input) {
      if (!validArcadeTableCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      return (document) => {
        document.arcadeTableRequests ??= {};
        const records = document.arcadeTableRequests;
        const fingerprint = JSON.stringify({ type: 'leave', ...input });
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
        if (match.session && match.session.hostId !== localHostId) throw new ApiSdkError('NOT_ALLOWED');
        const before = document.farm.coins;
        if (match.status === 'playing') settle(document, match, false);
        if (input.gameId === 'diamonds') delete document.arcade!.activeBattle;
        else if (input.gameId === 'phom') delete document.phom!.activeMatch;
        else if (isMiniGameId(input.gameId)) delete document.mini![input.gameId]!.activeMatch;
        else delete document.tien!.activeMatch;
        const result = { coins: document.farm.coins, coinDelta: document.farm.coins - before };
        records[input.requestId] = { fingerprint, result };
        prune(records, input.requestId);
        return result;
      };
    },
  };
}
