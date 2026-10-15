import { ApiSdkError } from '@chibi-town/contracts';
import {
  type ArcadeMemberCommand,
  type ArcadeTableCommand,
  type ArcadeTableSettings,
  validArcadeMemberCommand,
  validArcadeSettings,
  validArcadeTableCommand,
} from '@chibi-town/contracts/arcade-table';
import { ARCADE_PRACTICE_ROOM_ID, type ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { createGameService } from '@chibi-town/game-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { arcadeChannel } from '@/modules/arcade/arcade-channel';
import {
  type ArcadePlay,
  type ArcadeStart,
  matchIdOf,
  playPractice,
  practiceLobby,
  startPractice,
  validateStart,
} from '@/modules/arcade/practice';
import { randomSeed } from '@/modules/arcade/random-seed';
import type { TableService } from '@/modules/arcade/tables';
import { type TransactionTrace, withPlayerDocument, withPlayerTransaction } from '@/modules/player';

export function createArcadeService(deps: { db: Database; clock: () => number; tables: TableService }) {
  const { db, clock, tables } = deps;

  const practiceFor = (player: PlayerAccount) => createGameService({ player, clock, randomSeed, live: true });

  async function isSeated(playerId: string, input: ArcadeTableCommand) {
    return (
      !!input && tables.has(input.gameId) && (await tables.seatedMatchId(playerId, input.gameId)) === input.matchId
    );
  }

  return {
    async getLobby(player: PlayerAccount, gameId: ArcadeGameId, trace?: TransactionTrace) {
      const read = practiceLobby(practiceFor(player), gameId);
      const saved = await withPlayerDocument(
        db,
        player.id,
        (document) => ({ lobby: read(document), channel: arcadeChannel(document) }),
        trace,
        clock,
      );
      const [open, mine] = await Promise.all([tables.directory(gameId, saved.channel), tables.view(player.id, gameId)]);
      const activeKey = gameId === 'diamonds' ? 'activeBattle' : 'activeMatch';
      const lobby = saved.lobby;
      const active =
        'activeBattle' in lobby ? lobby.activeBattle : 'activeMatch' in lobby ? lobby.activeMatch : undefined;
      return {
        ...lobby,
        [activeKey]: mine ?? active,
        rooms: lobby.rooms.map((room) =>
          room.id === ARCADE_PRACTICE_ROOM_ID
            ? room
            : {
                id: room.id,
                tables: room.tables.map((table) => ({
                  ...table,
                  ...(open.get(`${room.id}:${table.id}`) ?? { occupants: 0, status: 'empty' as const }),
                })),
              },
        ),
      };
    },

    async start(player: PlayerAccount, gameId: ArcadeGameId, input: ArcadeStart, trace?: TransactionTrace) {
      validateStart(gameId, input);
      if (input.roomId === ARCADE_PRACTICE_ROOM_ID) {
        const operation = startPractice(practiceFor(player), gameId, input);
        return withPlayerTransaction(
          db,
          player.id,
          async (document, tx) => {
            if (document.tableStakes?.[gameId] || (await tables.seatedMatchId(player.id, gameId, tx)))
              throw new ApiSdkError('MATCH_IN_PROGRESS');
            return operation(document);
          },
          trace,
          clock,
        );
      }
      const channel = await withPlayerDocument(db, player.id, arcadeChannel, trace, clock);
      trace?.('sit-at-table');
      return tables.sit(player, gameId, channel, input);
    },

    async play(player: PlayerAccount, gameId: ArcadeGameId, input: ArcadePlay, trace?: TransactionTrace) {
      const matchId = matchIdOf(gameId, input);
      const seated = await tables.seatedMatchId(player.id, gameId);
      if (seated && seated === matchId) {
        trace?.('play-at-table');
        return tables.play(player.id, gameId, { ...input, matchId });
      }
      const operation = playPractice(practiceFor(player), gameId, input);
      return withPlayerDocument(db, player.id, (document) => operation(document), trace, clock);
    },

    async updateMember(player: PlayerAccount, input: ArcadeMemberCommand, trace?: TransactionTrace) {
      if (!(await isSeated(player.id, input))) {
        const operation = practiceFor(player).updateArcadeMember(input);
        return withPlayerDocument(db, player.id, (document) => operation(document), trace, clock);
      }
      if (!validArcadeMemberCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      trace?.('update-table-member');
      return tables.member(player.id, input.gameId, input);
    },

    async configure(player: PlayerAccount, input: ArcadeTableSettings, trace?: TransactionTrace) {
      if (!(await isSeated(player.id, input))) {
        const operation = practiceFor(player).configureArcadeTable(input);
        return withPlayerDocument(db, player.id, (document) => operation(document), trace, clock);
      }
      if (!validArcadeSettings(input)) throw new ApiSdkError('INVALID_COMMAND');
      trace?.('configure-table');
      return tables.configure(player.id, input.gameId, input);
    },

    async leave(player: PlayerAccount, input: ArcadeTableCommand, trace?: TransactionTrace) {
      if (!(await isSeated(player.id, input))) {
        const operation = practiceFor(player).leaveArcadeTable(input);
        return withPlayerDocument(db, player.id, (document) => operation(document), trace, clock);
      }
      if (!validArcadeTableCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      trace?.('leave-table');
      return tables.leave(player.id, input.gameId, input.matchId);
    },
  };
}

export type ArcadeService = ReturnType<typeof createArcadeService>;
