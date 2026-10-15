import { isMiniGameId } from '@chibi-town/arcade-games/mini-games-logic';
import {
  ApiSdkError,
  decodeChannelDirectory,
  decodeCommandResult,
  decodePlayer,
  decodeSnapshot,
  decodeWorld,
  type GameSdk,
  validateCommand,
  validateMapChannelInput,
} from '@chibi-town/contracts';
import {
  decodeArcadeLobby,
  decodeGemBattle,
  decodeGemResult,
  validDiamondCommand,
  validDiamondStart,
} from '@chibi-town/contracts/arcade';
import {
  decodeArcadeTableResult,
  validArcadeMemberCommand,
  validArcadeSettings,
  validArcadeTableCommand,
} from '@chibi-town/contracts/arcade-table';
import {
  decodeCharacterInventoryPage,
  validateCharacterInventoryQuery,
} from '@chibi-town/contracts/character-inventory';
import {
  decodeMiniLobby,
  decodeMiniResult,
  decodeMiniSnapshot,
  validMiniCommand,
  validMiniStart,
} from '@chibi-town/contracts/mini-games';
import { decodePhomLobby, decodePhomResult, decodePhomSnapshot, validPhomCommand } from '@chibi-town/contracts/phom';
import {
  decodeTienLobby,
  decodeTienResult,
  decodeTienSnapshot,
  validTienCommand,
  validTienStart,
} from '@chibi-town/contracts/tien-len';

/** Transport can be replaced/injected for contract tests. No consumer knows endpoints. */
export function createHttpSdk(options: {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Called when the server no longer accepts the session, before the call rejects. */
  onUnauthenticated?: () => void;
}): GameSdk {
  const transport = options.fetch ?? fetch;

  async function request<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await transport(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiSdkError('NETWORK_ERROR');
    }
    const data = await response.json().catch(() => {
      throw new ApiSdkError('NETWORK_ERROR');
    });
    if (!response.ok) {
      const codes = [
        'INVALID_COMMAND',
        'NOT_ALLOWED',
        'ACCOUNT_REQUIRED',
        'INSUFFICIENT_COINS',
        'INVENTORY_FULL',
        'REQUEST_CONFLICT',
        'STORAGE_UNAVAILABLE',
        'NETWORK_ERROR',
        'MAP_NOT_FOUND',
        'CHANNEL_FULL',
        'INVALID_CHANNEL',
        'INVALID_MOVE',
        'NO_MATCH',
        'NOT_ENOUGH_MANA',
        'INVALID_TURN',
        'INVALID_PLAY',
        'CANNOT_PASS',
        'MATCH_FINISHED',
        'MATCH_IN_PROGRESS',
        'UNAUTHENTICATED',
      ];
      if (data?.code === 'UNAUTHENTICATED') options.onUnauthenticated?.();
      throw new ApiSdkError(codes.includes(data?.code) ? data.code : 'NETWORK_ERROR');
    }
    return data as T;
  }

  const decodeArcade = <T>(decode: (value: unknown) => T, value: unknown): T => {
    try {
      return decode(value);
    } catch {
      throw new ApiSdkError('NETWORK_ERROR');
    }
  };

  return {
    getMiniLobby: async (gameId) => {
      if (!isMiniGameId(gameId)) throw new ApiSdkError('INVALID_COMMAND');
      const lobby = decodeArcade(decodeMiniLobby, await request(`/arcade/mini/${gameId}`));
      if (lobby.gameId !== gameId) throw new ApiSdkError('NETWORK_ERROR');
      return lobby;
    },

    startMiniRoom: async (input) => {
      if (!validMiniStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      const match = decodeArcade(decodeMiniSnapshot, await request(`/arcade/mini/${input.gameId}/start`, input));
      if (match.gameId !== input.gameId || match.roomId !== input.roomId || match.tableId !== (input.tableId ?? 0))
        throw new ApiSdkError('NETWORK_ERROR');
      return match;
    },

    playMini: async (command) => {
      if (!validMiniCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      const result = decodeArcade(decodeMiniResult, await request(`/arcade/mini/${command.gameId}/play`, command));
      if (
        result.match.gameId !== command.gameId ||
        result.match.id !== command.matchId ||
        result.match.revision !== command.revision + 1
      )
        throw new ApiSdkError('NETWORK_ERROR');
      return result;
    },

    updateArcadeMember: async (input) => {
      if (!validArcadeMemberCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      return decodeArcade(decodeArcadeTableResult, await request('/arcade/table/member', input));
    },

    configureArcadeTable: async (input) => {
      if (!validArcadeSettings(input)) throw new ApiSdkError('INVALID_COMMAND');
      return decodeArcade(decodeArcadeTableResult, await request('/arcade/table/configure', input));
    },

    leaveArcadeTable: async (input) => {
      if (!validArcadeTableCommand(input)) throw new ApiSdkError('INVALID_COMMAND');
      return decodeArcade(decodeArcadeTableResult, await request('/arcade/table/leave', input));
    },

    getPhomLobby: async () => decodeArcade(decodePhomLobby, await request('/arcade/phom')),

    startPhomRoom: async (input) => {
      if (!validTienStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      const match = decodeArcade(decodePhomSnapshot, await request('/arcade/phom/start', input));
      if (match.roomId !== input.roomId || (match.tableId ?? 0) !== (input.tableId ?? 0))
        throw new ApiSdkError('NETWORK_ERROR');
      return match;
    },

    playPhom: async (command) => {
      if (!validPhomCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      const result = decodeArcade(decodePhomResult, await request('/arcade/phom/play', command));
      if (result.match.id !== command.matchId || result.match.revision !== command.revision + 1)
        throw new ApiSdkError('NETWORK_ERROR');
      return result;
    },

    getTienLobby: async () => decodeArcade(decodeTienLobby, await request('/arcade/tien-len')),

    startTienRoom: async (input) => {
      if (!validTienStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      const match = decodeArcade(decodeTienSnapshot, await request('/arcade/tien-len/start', input));
      if (match.roomId !== input.roomId || (match.tableId ?? 0) !== (input.tableId ?? 0))
        throw new ApiSdkError('NETWORK_ERROR');
      return match;
    },

    playTien: async (command) => {
      if (!validTienCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      const result = decodeArcade(decodeTienResult, await request('/arcade/tien-len/play', command));
      if (result.match.id !== command.matchId || result.match.revision !== command.revision + 1)
        throw new ApiSdkError('NETWORK_ERROR');
      return result;
    },

    getArcadeLobby: async () => decodeArcade(decodeArcadeLobby, await request('/arcade')),

    startDiamondRoom: async (input) => {
      if (!validDiamondStart(input)) throw new ApiSdkError('INVALID_COMMAND');
      const battle = decodeArcade(decodeGemBattle, await request('/arcade/diamonds/start', input));
      if (battle.roomId !== input.roomId || (battle.tableId ?? 0) !== (input.tableId ?? 0))
        throw new ApiSdkError('NETWORK_ERROR');
      return battle;
    },

    playDiamond: async (command) => {
      if (!validDiamondCommand(command)) throw new ApiSdkError('INVALID_COMMAND');
      const result = decodeArcade(decodeGemResult, await request('/arcade/diamonds/play', command));
      if (result.battle.id !== command.battleId || result.battle.revision !== command.revision + 1)
        throw new ApiSdkError('NETWORK_ERROR');
      return result;
    },

    getMapChannels: async (input) => {
      validateMapChannelInput(input);
      const directory = decodeChannelDirectory(await request('/maps/channels', input));
      if (directory.regionId !== input.regionId || directory.mapId !== input.mapId)
        throw new ApiSdkError('NETWORK_ERROR', 'Unexpected channel map');
      return directory;
    },

    joinMapChannel: async (input) => {
      validateMapChannelInput(input, input.channelId);
      if (!Number.isSafeInteger(input.channelId)) throw new ApiSdkError('INVALID_CHANNEL');
      const directory = decodeChannelDirectory(await request('/maps/channels/join', input));
      if (
        directory.regionId !== input.regionId ||
        directory.mapId !== input.mapId ||
        directory.currentChannelId !== input.channelId
      )
        throw new ApiSdkError('NETWORK_ERROR', 'Unexpected channel membership');
      return directory;
    },

    getPlayer: async () => decodePlayer(await request('/player')),

    getWorld: async () => decodeWorld(await request('/world')),

    getMap: async (input) => decodeSnapshot(await request('/maps/snapshot', input)),

    getInventory: async () => decodeSnapshot(await request('/inventory')),

    getCharacterInventory: async (query) => {
      validateCharacterInventoryQuery(query);
      return decodeCharacterInventoryPage(await request('/character-inventory', query));
    },

    execute: async (command) => {
      validateCommand(command);
      return decodeCommandResult(await request('/commands', command));
    },
  };
}
