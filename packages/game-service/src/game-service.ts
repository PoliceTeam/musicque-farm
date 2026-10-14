import {
  createGemBattle,
  gemBattleSnapshot,
  gemPublicResult,
  playGemAction,
} from '@chibi-town/arcade-games/gem-battle-logic';
import {
  createMiniMatch,
  isMiniGameId,
  type MiniGameId,
  miniCoinDelta,
  miniMemberCoinDeltas,
  miniSnapshot,
  playMiniAction,
} from '@chibi-town/arcade-games/mini-games-logic';
import { createPhomMatch, phomSnapshot, playPhomAction } from '@chibi-town/arcade-games/phom-logic';
import { type ArcadeSession, arcadeAllReady, arcadeMembers } from '@chibi-town/arcade-games/session';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import { createTienMatch, playTienAction, tienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import {
  ApiSdkError,
  type ChannelDirectory,
  type GameSdk,
  type MapChannelInput,
  type Snapshot,
  validateCommand,
  validateMapChannelInput,
} from '@chibi-town/contracts';
import { type ArcadeRoom, validDiamondCommand, validDiamondStart } from '@chibi-town/contracts/arcade';
import {
  validArcadeMemberCommand,
  validArcadeSettings,
  validArcadeTableCommand,
} from '@chibi-town/contracts/arcade-table';
import { validMiniCommand, validMiniStart } from '@chibi-town/contracts/mini-games';
import { validPhomCommand } from '@chibi-town/contracts/phom';
import { validTienCommand, validTienStart } from '@chibi-town/contracts/tien-len';
import { MAPS, REGIONS, resolveMap } from '@chibi-town/game-content';
import { ARCADE_GAMES, ARCADE_PRACTICE_ROOM_ID, ARCADE_ROOMS } from '@chibi-town/game-content/arcade-catalog';
import { FARM_ANIMAL_CATALOG } from '@chibi-town/game-content/farm-animal-catalog';
import { FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import {
  advanceFarmAnimals,
  animalMaturityMs,
  animalProduct,
  applyFarmBatch,
  butcherFarmAnimal,
  buyFarmAnimal,
  buyFarmSeeds,
  canStoreFarmGoods,
  collectFarmHerd,
  collectFarmProducts,
  collectFarmRecipe,
  createFarmProgress,
  cropStage,
  expandFarmUnit,
  farmAction,
  feedFarmHerd,
  feedFarmUnit,
  readyFarmAnimals,
  sellFarmAnimal,
  sellFarmItem,
  startFarmRecipe,
  transferFarmGoods,
  upgradeFarmChest,
} from '@chibi-town/gameplay';
import { farmUnitAnimals } from '@chibi-town/gameplay/farm-unit-logic';

import { type PlayerDocument, reservedArcadeCoins } from './player-document.js';
import { pruneReceipts } from './receipt-order.js';

type World = Awaited<ReturnType<GameSdk['getWorld']>>;
export type GameServiceOptions = {
  /** The authenticated player; table sessions record this id as host and member. */
  player: { id: string; name: string; username?: string | null; level: number };
  clock: () => number;
  /** Unit-interval random source; defaults to cryptographic entropy. */
  random?: () => number;
  /** Other players in a channel, excluding `player`. */
  channelPopulation?: (mapId: string, channelId: number, capacity: number) => number;
  /** True when lobbies and channels describe real players rather than a single local save. */
  live?: boolean;
  world?: World;
};
/**
 * Every SDK call as a two-step function: the outer call validates the input, the returned operation reads and
 * mutates one player document. The caller owns storage and runs the operation inside its own transaction.
 */
export type GameService = {
  [K in keyof GameSdk]: (
    ...args: Parameters<GameSdk[K]>
  ) => (document: PlayerDocument) => Awaited<ReturnType<GameSdk[K]>>;
};

export function createGameService(options: GameServiceOptions): GameService {
  const clock = options.clock;

  const randomSeed = () => {
    if (options.random) {
      const value = options.random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new ApiSdkError('INVALID_COMMAND');
      return Math.floor(value * 4294967296);
    }
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  };

  const lobbySource = options.live ? ('live' as const) : ('local' as const);

  const snapshot = (document: PlayerDocument, now: number, farm = document.farm, mapInstanceId = 'home'): Snapshot => ({
    mapInstanceId,
    revision: document.revision,
    serverTime: now,
    farm: structuredClone(farm),
    outfit: structuredClone(document.outfit ?? defaultOutfit),
  });

  function instance(document: PlayerDocument, id: string) {
    if (id === 'home') return document.farm;
    const state = document.instances?.[id];
    if (!state) throw new ApiSdkError('MAP_NOT_FOUND');
    state.coins = document.farm.coins;
    state.gems = document.farm.gems;
    state.seeds = document.farm.seeds;
    state.inventory = document.farm.inventory;
    state.chests = document.farm.chests;
    state.homeInventory = document.farm.homeInventory;
    return state;
  }

  function read() {
    return (document: PlayerDocument) => {
      const now = clock();
      if (advanceFarmAnimals(document.farm, now)) document.revision++;
      return snapshot(document, now);
    };
  }

  function channelMap(input: MapChannelInput) {
    validateMapChannelInput(input);
    const map =
      options.world?.maps.find((entry) => entry.regionId === input.regionId && entry.id === input.mapId) ??
      resolveMap(input.regionId, input.mapId);
    if (!map?.channels) throw new ApiSdkError('MAP_NOT_FOUND');
    return map;
  }

  function population(mapId: string, id: number, capacity: number) {
    const count = options.channelPopulation?.(mapId, id, capacity) ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count > capacity) throw new ApiSdkError('INVALID_CHANNEL');
    return count;
  }

  function directory(document: PlayerDocument, input: MapChannelInput): ChannelDirectory {
    const map = channelMap(input);
    const { count, capacity } = map.channels!;
    const saved = document.channelSelections?.[map.id];
    const currentChannelId = Number.isSafeInteger(saved) && saved! >= 0 && saved! < count ? saved! : 0;
    return {
      ...input,
      source: options.live ? 'live' : 'mock',
      currentChannelId,
      channels: Array.from({ length: count }, (_, id) => ({
        id,
        capacity,
        occupants: Math.min(capacity, population(map.id, id, capacity) + (id === currentChannelId ? 1 : 0)),
      })),
    };
  }

  const arcade = (document: PlayerDocument) => (document.arcade ??= { bestScore: 0, starts: {}, requests: {} });

  const prune = pruneReceipts;
  const localHostId = options.player.id;
  const reservedCoins = reservedArcadeCoins;

  const botAvailable = (document: PlayerDocument, id: string, gameId: string) => {
    const reserved = Object.entries(document.mini ?? {}).reduce((sum, [game, state]) => {
      const match = state?.activeMatch;
      if (game === gameId || match?.status !== 'playing' || match.session?.mode !== 'wager' || match.session.settled)
        return sum;
      return sum + (match.session.members?.find((member) => member.id === id)?.stake ?? 0);
    }, 0);
    return Math.max(0, (document.arcadeBotCoins?.[id] ?? 10000) - reserved);
  };

  const settle = (document: PlayerDocument, match: { session?: ArcadeSession }, won: boolean, deltas?: number[]) => {
    const session = match.session;
    if (!session || session.settled) return;
    const delta = session.mode === 'wager' ? (deltas ? deltas[0] : won ? session.stake : -session.stake) : 0;
    const coins = document.farm.coins + delta;
    if (!Number.isSafeInteger(coins) || coins < 0) throw new ApiSdkError('INSUFFICIENT_COINS');
    document.farm.coins = coins;
    session.settled = true;
    session.coinDelta = delta;
    if (deltas) session.coinDeltas = session.mode === 'wager' ? deltas : [0, 0, 0, 0];
    if (delta) document.revision++;
  };

  const sessionFor = (roomId: number, difficulty?: ArcadeSession['difficulty']): ArcadeSession => ({
    hostId: localHostId,
    mode: roomId === ARCADE_PRACTICE_ROOM_ID ? 'practice' : 'wager',
    stake: 0,
    configured: false,
    difficulty: difficulty ?? 'medium',
  });

  const checkStart = (document: PlayerDocument, session?: ArcadeSession) => {
    if (
      session &&
      (session.hostId !== localHostId || session.configured === false || (session.members && !arcadeAllReady(session)))
    )
      throw new ApiSdkError('NOT_ALLOWED');
    if (
      session?.mode === 'wager' &&
      (session.stake < 1 || session.stake > document.farm.coins - reservedCoins(document))
    )
      throw new ApiSdkError('INSUFFICIENT_COINS');
  };

  const tableDirectory = (
    capacity: number,
    active?: { roomId: number; tableId?: number; status: string; session?: ArcadeSession },
  ): ArcadeRoom[] =>
    ARCADE_ROOMS.map((room) => ({
      id: room.id,
      tables: room.tableIds.map((id) => {
        const occupied =
          active &&
          active.roomId === room.id &&
          (active.tableId ?? 0) === id &&
          ['playing', 'waiting'].includes(active.status);
        return {
          id,
          capacity,
          occupants: occupied
            ? (active.session?.members?.length ?? (capacity === 4 ? (active.session?.playerCount ?? 4) : capacity))
            : 0,
          status: occupied ? (active.status === 'waiting' ? 'waiting' : 'playing') : 'empty',
        };
      }),
    }));

  const phom = (document: PlayerDocument) => (document.phom ??= { wins: 0, starts: {}, requests: {} });

  const tien = (document: PlayerDocument) => (document.tien ??= { wins: 0, starts: {}, requests: {} });

  const mini = (document: PlayerDocument, gameId: MiniGameId) => {
    document.mini ??= {};
    document.mini[gameId] ??= { wins: 0, starts: {}, requests: {} };
    return document.mini[gameId]!;
  };

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
          input.gameId === 'bau-cua' || input.gameId === 'slots' ? randomSeed() : clock(),
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
        const prepared = structuredClone(match);
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
          ready: m.id === localHostId ? true : m.ready,
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
        state.activeMatch = createPhomMatch(input.requestId, input.roomId, clock(), input.tableId ?? 0);
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
          next = playPhomAction(match, command.action);
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

    getMapChannels(input) {
      return (document) => directory(document, input);
    },

    joinMapChannel(input) {
      validateMapChannelInput(input, input.channelId);
      if (!Number.isSafeInteger(input.channelId)) throw new ApiSdkError('INVALID_CHANNEL');
      return (document) => {
        const before = directory(document, input);
        const channel = before.channels.find((entry) => entry.id === input.channelId);
        if (!channel) throw new ApiSdkError('INVALID_CHANNEL');
        if (before.currentChannelId !== input.channelId && channel.occupants >= channel.capacity)
          throw new ApiSdkError('CHANNEL_FULL');
        document.channelSelections ??= {};
        document.channelSelections[input.mapId] = input.channelId;
        return directory(document, { regionId: input.regionId, mapId: input.mapId });
      };
    },

    getPlayer() {
      return (document) => ({
        ...options.player,
        username: options.player.username ?? null,
        outfit: structuredClone(document.outfit ?? defaultOutfit),
      });
    },

    getWorld() {
      return () => structuredClone(options.world ?? { regions: REGIONS, maps: MAPS });
    },

    getMap(input) {
      if (
        !(
          options.world?.maps.find((map) => map.regionId === input.regionId && map.id === input.mapId) ??
          resolveMap(input.regionId, input.mapId)
        ) ||
        !/^[-a-zA-Z0-9_]{1,80}$/.test(input.instanceId)
      )
        throw new ApiSdkError('MAP_NOT_FOUND');
      return (document) => {
        const id =
          input.mapId === 'farm-home' && input.instanceId === 'home' ? 'home' : `${input.mapId}:${input.instanceId}`;
        if (id !== 'home') {
          document.instances ??= {};
          document.instances[id] ??= createFarmProgress();
        }
        const farm = instance(document, id);
        const now = clock();
        if (advanceFarmAnimals(farm, now)) document.revision++;
        return snapshot(document, now, farm, id);
      };
    },

    getInventory: read,

    execute(command) {
      validateCommand(command);
      return (document) => {
        const state = instance(document, command.mapInstanceId);
        const fingerprint = JSON.stringify(command);
        const prior = Object.hasOwn(document.requests, command.requestId)
          ? document.requests[command.requestId]
          : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return { ...snapshot(document, clock(), state, command.mapInstanceId), ...prior.result };
        }
        const now = clock();

        advanceFarmAnimals(state, now);
        let completed = 0,
          eligible = 1;
        switch (command.type) {
          case 'equip-outfit':
            document.outfit = sanitizeOutfit(command.outfit);
            completed = 1;
            break;
          case 'plot':
            if (
              command.action === 'harvest' &&
              state.plots[command.index] &&
              cropStage(state.plots[command.index], now) === 'ripe'
            ) {
              const id = state.plots[command.index].cropId ?? 'strawberry';
              if (!canStoreFarmGoods(state, { [id]: FARM_CROPS[id].yield })) throw new ApiSdkError('INVENTORY_FULL');
            }
            completed = Number(farmAction(state, command.index, command.action, now, command.cropId));
            break;
          case 'batch':
            ({ completed, eligible } = applyFarmBatch(state, command.action, now, command.cropId));
            if (!completed && eligible > 0 && command.action === 'harvest') throw new ApiSdkError('INVENTORY_FULL');
            break;
          case 'expand':
            completed = Number(expandFarmUnit(state, command.unit));
            break;
          case 'feed':
            completed = Number(feedFarmUnit(state, command.unit, now));
            break;
          case 'collect': {
            const additions: Parameters<typeof canStoreFarmGoods>[1] = {};
            for (const animal of readyFarmAnimals(state, command.unit)) {
              const product = animalProduct(animal);
              additions[product] = (additions[product] ?? 0) + (FARM_ANIMAL_CATALOG[animal.species].yield || 1);
            }
            if (!canStoreFarmGoods(state, additions)) throw new ApiSdkError('INVENTORY_FULL');
            completed = collectFarmProducts(state, command.unit, now);
            break;
          }
          case 'buy-animal':
            completed = Number(buyFarmAnimal(state, command.unit, command.species, now));
            break;
          case 'buy-seeds':
            completed = Number(buyFarmSeeds(state, command.count, command.cropId));
            break;
          case 'cook':
            completed = Number(startFarmRecipe(state, command.recipeId, now, command.requestId));
            break;
          case 'collect-dish': {
            const job = state.kitchen.find((job) => job.id === command.jobId);
            if (job && now >= job.readyAt && !canStoreFarmGoods(state, { [job.recipeId]: 1 }))
              throw new ApiSdkError('INVENTORY_FULL');
            completed = Number(collectFarmRecipe(state, command.jobId, now));
            break;
          }
          case 'sell-animal':
            completed = Number(
              sellFarmAnimal(
                state,
                command.unit,
                farmUnitAnimals(state, command.unit).findIndex((animal) => animal.id === command.animalId),
                now,
              ),
            );
            break;
          case 'butcher-animal': {
            const animal = farmUnitAnimals(state, command.unit).find((animal) => animal.id === command.animalId);
            if (
              animal &&
              ['cow', 'pig', 'fish'].includes(animal.species) &&
              (animal.ageMs ?? 0) >= animalMaturityMs(animal)
            ) {
              const product = animal.species === 'cow' ? 'beef' : animal.species === 'pig' ? 'pork' : 'fish';
              if (!canStoreFarmGoods(state, { [product]: 1 })) throw new ApiSdkError('INVENTORY_FULL');
            }
            completed = Number(
              butcherFarmAnimal(
                state,
                command.unit,
                farmUnitAnimals(state, command.unit).findIndex((animal) => animal.id === command.animalId),
                now,
              ),
            );
            break;
          }
          case 'upgrade-chest':
            completed = Number(upgradeFarmChest(state, command.chest));
            break;
          case 'transfer-goods':
            if (
              !canStoreFarmGoods(state, { [command.product]: command.count }, command.from === 'main' ? 'home' : 'main')
            )
              throw new ApiSdkError('INVENTORY_FULL');
            completed = Number(transferFarmGoods(state, command.from, command.product, command.count));
            break;
          case 'sell':
            completed = Number(sellFarmItem(state, command.product, command.count, command.chest));
            break;
          case 'feed-all':
            completed = feedFarmHerd(state, now);
            break;
          case 'collect-all':
            completed = collectFarmHerd(state, now);
            if (
              !completed &&
              ['livestock', 'poultry', 'pond'].some(
                (unit) => readyFarmAnimals(state, unit as 'livestock' | 'poultry' | 'pond').length > 0,
              )
            )
              throw new ApiSdkError('INVENTORY_FULL');
            break;
          default:
            throw new ApiSdkError('INVALID_COMMAND');
        }
        if (!completed) throw new ApiSdkError('NOT_ALLOWED');
        if (state.coins < reservedCoins(document)) throw new ApiSdkError('INSUFFICIENT_COINS');
        document.farm.coins = state.coins;
        document.farm.gems = state.gems;
        document.farm.seeds = state.seeds;
        document.farm.inventory = state.inventory;
        document.farm.chests = state.chests;
        document.farm.homeInventory = state.homeInventory;
        document.revision++;
        const result = { ...snapshot(document, now, state, command.mapInstanceId), completed, eligible };
        Object.defineProperty(document.requests, command.requestId, {
          value: { fingerprint, result: { completed, eligible } },
          enumerable: true,
          configurable: true,
          writable: true,
        });
        return result;
      };
    },
  };
}
