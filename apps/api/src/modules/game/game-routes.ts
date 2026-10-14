import { ApiSdkError } from '@chibi-town/contracts';
import type { ArcadeRoom } from '@chibi-town/contracts/arcade';
import { validDiamondStart } from '@chibi-town/contracts/arcade';
import {
  validArcadeMemberCommand,
  validArcadeSettings,
  validArcadeTableCommand,
} from '@chibi-town/contracts/arcade-table';
import { validMiniStart } from '@chibi-town/contracts/mini-games';
import { validTienStart } from '@chibi-town/contracts/tien-len';
import { ARCADE_PRACTICE_ROOM_ID, type ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { GameService, PlayerDocument } from '@chibi-town/game-service';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '@/_utils/http-errors';
import { type PlayerAccount, readSession, SESSION_COOKIE } from '@/_utils/session-auth';
import type { Database } from '@/db/database';
import { arcadeChannel } from '@/modules/game/arcade-channel';
import type { ChannelPresence } from '@/modules/game/channel-presence';
import { withPlayerDocument } from '@/modules/game/player-document-repository';
import type { TableService } from '@/modules/tables/table-service';

/** Validates the request and returns the operation to run on the player's save. */
type Prepare = (
  service: GameService,
  body: never,
  params: Record<string, string>,
) => (document: PlayerDocument) => unknown;
/** Paths and bodies match `createHttpSdk` in `@chibi-town/api-sdk`. */
const readers: Record<string, Prepare> = {
  '/player': (service) => service.getPlayer(),

  '/world': (service) => service.getWorld(),

  '/inventory': (service) => service.getInventory(),
};
const commands: Record<string, Prepare> = {
  '/commands': (service, body) => service.execute(body),

  '/maps/snapshot': (service, body) => service.getMap(body),
};
/**
 * Games whose wager rooms are tables of people. Their practice room still runs on the player's own save with
 * bots, so each request is sent to the table or to the save depending on where the player's match lives.
 */
const tableGameRoutes: {
  gameId: ArcadeGameId;
  path: string;
  lobbyPath?: string;
  activeKey?: 'activeBattle';
  lobby: (
    service: GameService,
  ) => (document: PlayerDocument) => { rooms: readonly ArcadeRoom[]; activeMatch?: unknown; activeBattle?: unknown };
  validStart: (body: never) => boolean;
  start: Prepare;
  play: Prepare;
}[] = [
  {
    gameId: 'tien-len',
    path: '/arcade/tien-len',

    lobby: (service) => service.getTienLobby(),

    validStart: validTienStart,

    start: (service, body) => service.startTienRoom(body),

    play: (service, body) => service.playTien(body),
  },
  {
    gameId: 'phom',
    path: '/arcade/phom',

    lobby: (service) => service.getPhomLobby(),

    validStart: validTienStart,

    start: (service, body) => service.startPhomRoom(body),

    play: (service, body) => service.playPhom(body),
  },
  ...(['chess', 'chinese-chess', 'bau-cua', 'slots'] as const).map((gameId) => ({
    gameId,
    path: `/arcade/mini/${gameId}`,

    lobby: (service: GameService) => service.getMiniLobby(gameId),

    validStart: (body: never) => validMiniStart(body) && (body as { gameId: string }).gameId === gameId,

    start: ((service, body) => service.startMiniRoom(body)) as Prepare,

    play: ((service, body) => service.playMini(body)) as Prepare,
  })),
  {
    gameId: 'diamonds',
    path: '/arcade/diamonds',
    lobbyPath: '/arcade',
    activeKey: 'activeBattle',

    lobby: (service) => service.getArcadeLobby(),

    validStart: validDiamondStart,

    start: (service, body) => service.startDiamondRoom(body),

    play: (service, body) => service.playDiamond(body),
  },
];
const tableCommands: Record<string, Prepare> = {
  member: (service, body) => service.updateArcadeMember(body),

  configure: (service, body) => service.configureArcadeTable(body),

  leave: (service, body) => service.leaveArcadeTable(body),
};

export function registerGameRoutes(
  app: FastifyInstance,
  deps: {
    db: Database;
    clock: () => number;
    presence: ChannelPresence;
    serviceFor: (player: PlayerAccount) => Promise<GameService>;
    tables: TableService;
  },
) {
  const { db, clock, presence, serviceFor, tables } = deps;

  async function authenticate(request: FastifyRequest) {
    const player = await readSession(db, request.cookies[SESSION_COOKIE], clock());
    if (!player) throw new HttpError(401, 'UNAUTHENTICATED');
    await presence.touch(player.id, clock());
    return player;
  }

  const input = (request: FastifyRequest) => (request.body ?? null) as never;

  async function run(request: FastifyRequest, prepare: Prepare) {
    const player = await authenticate(request);
    return withPlayerDocument(
      db,
      player.id,
      prepare(await serviceFor(player), input(request), request.params as Record<string, string>),
    );
  }

  for (const [path, prepare] of Object.entries(readers)) app.get(path, (request) => run(request, prepare));
  for (const [path, prepare] of Object.entries(commands)) app.post(path, (request) => run(request, prepare));

  const onSave = async <T>(player: PlayerAccount, prepare: (service: GameService) => (document: PlayerDocument) => T) =>
    withPlayerDocument(db, player.id, prepare(await serviceFor(player)));

  for (const game of tableGameRoutes) {
    app.get(game.lobbyPath ?? game.path, async (request) => {
      const player = await authenticate(request);
      const lobby = await onSave(player, (service) => {
        const read = game.lobby(service);
        return (document) => ({ lobby: read(document), channel: arcadeChannel(document) });
      });
      const [open, mine] = await Promise.all([
        tables.directory(game.gameId, lobby.channel),
        tables.view(player.id, game.gameId),
      ]);
      return {
        ...lobby.lobby,
        [game.activeKey ?? 'activeMatch']: mine ?? lobby.lobby[game.activeKey ?? 'activeMatch'],
        rooms: lobby.lobby.rooms.map((room) =>
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
    });
    app.post(`${game.path}/start`, async (request) => {
      const player = await authenticate(request);
      const body = input(request) as { roomId: number; tableId?: number; requestId: string };
      if (!game.validStart(body as never)) throw new ApiSdkError('INVALID_COMMAND');
      if (body.roomId === ARCADE_PRACTICE_ROOM_ID) {
        if (await tables.seatedMatchId(player.id, game.gameId)) throw new ApiSdkError('MATCH_IN_PROGRESS');
        return onSave(player, (service) => game.start(service, body as never, {}));
      }
      return tables.sit(player, game.gameId, await onSave(player, () => arcadeChannel), body);
    });
    app.post(`${game.path}/play`, async (request) => {
      const player = await authenticate(request);
      const body = input(request) as { matchId?: string; battleId?: string; requestId: string; revision: number };
      if (game.gameId === 'diamonds' && body) body.matchId = body.battleId;
      const seated = await tables.seatedMatchId(player.id, game.gameId);
      return seated && seated === body?.matchId
        ? tables.play(player.id, game.gameId, body)
        : onSave(player, (service) => game.play(service, body as never, {}));
    });
  }
  for (const [name, prepare] of Object.entries(tableCommands))
    app.post(`/arcade/table/${name}`, async (request) => {
      const player = await authenticate(request);
      const body = input(request) as { gameId: ArcadeGameId; matchId: string; requestId: string; stake: number };
      const seated = tables.has(body?.gameId) ? await tables.seatedMatchId(player.id, body.gameId) : undefined;
      if (!seated || seated !== body.matchId) return onSave(player, (service) => prepare(service, body as never, {}));
      const valid = {
        member: validArcadeMemberCommand,
        configure: validArcadeSettings,
        leave: validArcadeTableCommand,
      };
      if (!valid[name as keyof typeof valid](body as never)) throw new ApiSdkError('INVALID_COMMAND');
      if (name === 'configure') return tables.configure(player.id, body.gameId, body);
      if (name === 'member') return tables.member(player.id, body.gameId, body as never);
      return tables.leave(player.id, body.gameId, body.matchId);
    });

  async function channels(player: PlayerAccount, prepare: (service: GameService) => ReturnType<Prepare>, join = false) {
    const operation = prepare(await serviceFor(player));
    return withPlayerDocument(db, player.id, async (document) => {
      const directory = operation(document) as ReturnType<ReturnType<GameService['getMapChannels']>>;
      if (join) {
        const capacity = directory.channels.find((channel) => channel.id === directory.currentChannelId)!.capacity;
        if (!(await presence.claim(player.id, directory.mapId, directory.currentChannelId, capacity, clock())))
          throw new ApiSdkError('CHANNEL_FULL');
      } else await presence.enter(player.id, directory.mapId, directory.currentChannelId, clock());
      return directory;
    });
  }

  app.post('/maps/channels', async (request) =>
    channels(await authenticate(request), (service) => service.getMapChannels(input(request))),
  );
  app.post('/maps/channels/join', async (request) => {
    const player = await authenticate(request);
    const mapId = (request.body as { mapId?: unknown } | null)?.mapId;
    return presence.exclusive(typeof mapId === 'string' ? mapId : '', () =>
      channels(player, (service) => service.joinMapChannel(input(request)), true),
    );
  });
}
