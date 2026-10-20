import type { MiniGameId, MiniResult, MiniSnapshot } from '@chibi-town/arcade-games/mini-games-logic';
import type { PhomResult, PhomSnapshot } from '@chibi-town/arcade-games/phom-logic';
import type {
  ArcadeMemberCommand,
  ArcadeTableCommand,
  ArcadeTableResult,
  ArcadeTableSettings,
  ArcadeTableStart,
} from './arcade-table.js';
import type {
  CharacterInventoryCommand,
  CharacterInventoryPage,
  CharacterInventoryQuery,
  CosmeticUpgradeResult,
} from './character-inventory.js';
import { validUpgradeResult } from './character-inventory.js';
import type { MiniCommand, MiniLobby, MiniStart } from './mini-games.js';
import type { RaceBet, RaceLobby } from './pet-racing.js';
import type { PhomCommand, PhomLobby } from './phom.js';

export * from './arcade-table.js';

import type { TienResult, TienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import type { TienCommand, TienLobby } from './tien-len.js';

export * from './tien-len.js';

import type { GemBattleSnapshot, GemPublicResult } from '@chibi-town/arcade-games/gem-battle-logic';
import type { ArcadeLobby, DiamondCommand } from './arcade.js';

export * from './arcade.js';

import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { type MapDefinition, type RegionDefinition, validateWorld } from '@chibi-town/game-content';
import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { FARM_PRODUCTS } from '@chibi-town/game-content/farm-balance';
import { type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { FARM_RECIPES, type RecipeId } from '@chibi-town/game-content/farm-recipes';
import type { FarmChest } from '@chibi-town/game-content/farm-upgrade-catalog';
import type { FarmAction, FarmProduct, FarmProgress, FarmUnit } from '@chibi-town/gameplay';
import { parseFarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { type CharacterStats, decodeCharacterStats } from './character-stats.js';
export type Snapshot = {
  mapInstanceId: string;
  revision: number;
  serverTime: number;
  farm: FarmProgress;
  outfit: Outfit;
};
export type Command = { requestId: string; mapInstanceId: string } & (
  | CharacterInventoryCommand
  | { type: 'plot'; index: number; action: FarmAction; cropId?: CropId }
  | { type: 'batch'; action: FarmAction; cropId?: CropId }
  | { type: 'expand' | 'feed' | 'collect'; unit: FarmUnit }
  | { type: 'buy-animal'; unit: FarmUnit; species: FarmSpecies }
  | { type: 'buy-seeds'; cropId: CropId; count: number }
  | { type: 'cook'; recipeId: RecipeId }
  | { type: 'collect-dish'; jobId: string }
  | { type: 'sell-animal' | 'butcher-animal'; unit: FarmUnit; animalId: string }
  | { type: 'sell'; product: FarmProduct; count: number; chest?: FarmChest }
  | { type: 'upgrade-chest'; chest: FarmChest }
  | { type: 'transfer-goods'; from: FarmChest; product: FarmProduct; count: number }
  | { type: 'feed-all' | 'collect-all' }
  | { type: 'equip-outfit'; outfit: Outfit }
);
export type CommandResult = Snapshot & { completed: number; eligible: number; upgrade?: CosmeticUpgradeResult };
export type SdkErrorCode =
  | 'INVALID_COMMAND'
  | 'NOT_ALLOWED'
  | 'ACCOUNT_REQUIRED'
  | 'INVENTORY_FULL'
  | 'REQUEST_CONFLICT'
  | 'STORAGE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'MAP_NOT_FOUND'
  | 'CHANNEL_FULL'
  | 'INVALID_CHANNEL'
  | 'INVALID_MOVE'
  | 'NO_MATCH'
  | 'NOT_ENOUGH_MANA'
  | 'INVALID_TURN'
  | 'INVALID_PLAY'
  | 'CANNOT_PASS'
  | 'MATCH_FINISHED'
  | 'MATCH_IN_PROGRESS'
  | 'NOT_NEAR_JEWELER'
  | 'INSUFFICIENT_GEMS'
  | 'NOT_ENOUGH_MATERIALS'
  | 'INSUFFICIENT_COINS'
  | 'UNAUTHENTICATED';
export class ApiSdkError extends Error {
  constructor(
    public readonly code: SdkErrorCode,
    message: string = code,
    /** Internal diagnostic detail; HTTP responses continue to expose only code. */
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'ApiSdkError';
  }
}
export type MapChannelInput = { regionId: string; mapId: string };
export type ChannelDirectory = MapChannelInput & {
  source: 'mock' | 'live';
  currentChannelId: number;
  channels: readonly { id: number; occupants: number; capacity: number }[];
};

export function validateMapChannelInput(input: MapChannelInput, channelId?: number) {
  if (
    !input ||
    ![input.regionId, input.mapId].every((value) => typeof value === 'string' && /^[-a-zA-Z0-9_]{1,80}$/.test(value)) ||
    (channelId !== undefined && (!Number.isSafeInteger(channelId) || channelId < 0))
  )
    throw new ApiSdkError('INVALID_CHANNEL');
}

export function decodeChannelDirectory(value: unknown): ChannelDirectory {
  const data = value as ChannelDirectory;
  if (
    !data ||
    typeof data.regionId !== 'string' ||
    typeof data.mapId !== 'string' ||
    !['mock', 'live'].includes(data.source) ||
    !Number.isSafeInteger(data.currentChannelId) ||
    !Array.isArray(data.channels) ||
    !data.channels.length ||
    data.channels.length > 1000 ||
    data.channels.some(
      (channel) =>
        !channel ||
        !Number.isSafeInteger(channel.id) ||
        channel.id < 0 ||
        !Number.isSafeInteger(channel.capacity) ||
        channel.capacity < 1 ||
        channel.capacity > 10000 ||
        !Number.isSafeInteger(channel.occupants) ||
        channel.occupants < 0 ||
        channel.occupants > channel.capacity,
    ) ||
    new Set(data.channels.map((channel) => channel.id)).size !== data.channels.length ||
    !data.channels.some((channel) => channel.id === data.currentChannelId)
  )
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid channel response');
  return data;
}

export interface GameSdk {
  getJeweler(): Promise<import('./jeweler.js').JewelerSnapshot>;
  executeJeweler(input: import('./jeweler.js').JewelerCommand): Promise<import('./jeweler.js').JewelerSnapshot>;
  getLuckyDraw(): Promise<import('./lucky-draw.js').LuckyDrawSnapshot>;
  executeLuckyDraw(
    input: import('./lucky-draw.js').LuckyDrawCommand,
  ): Promise<import('./lucky-draw.js').LuckyDrawSnapshot>;
  getFarmVisit(ownerId: string): Promise<import('./farm-social.js').FarmVisit>;
  stealFarmCrop(input: import('./farm-social.js').StealFarmCrop): Promise<import('./farm-social.js').FarmVisit>;
  getFarmTheftHistory(): Promise<import('./farm-social.js').FarmTheftEntry[]>;
  getPetRace(): Promise<RaceLobby>;
  betPetRace(input: RaceBet): Promise<RaceLobby>;
  getMiniLobby(gameId: MiniGameId): Promise<MiniLobby>;
  startMiniRoom(input: MiniStart): Promise<MiniSnapshot>;
  playMini(command: MiniCommand): Promise<MiniResult>;
  getPhomLobby(): Promise<PhomLobby>;
  startPhomRoom(input: ArcadeTableStart): Promise<PhomSnapshot>;
  playPhom(command: PhomCommand): Promise<PhomResult>;
  updateArcadeMember(input: ArcadeMemberCommand): Promise<ArcadeTableResult>;
  configureArcadeTable(input: ArcadeTableSettings): Promise<ArcadeTableResult>;
  leaveArcadeTable(input: ArcadeTableCommand): Promise<ArcadeTableResult>;
  getTienLobby(): Promise<TienLobby>;
  startTienRoom(input: ArcadeTableStart): Promise<TienSnapshot>;
  playTien(command: TienCommand): Promise<TienResult>;
  getArcadeLobby(): Promise<ArcadeLobby>;
  startDiamondRoom(input: ArcadeTableStart): Promise<GemBattleSnapshot>;
  playDiamond(command: DiamondCommand): Promise<GemPublicResult>;
  getMapChannels(input: MapChannelInput): Promise<ChannelDirectory>;
  joinMapChannel(input: MapChannelInput & { channelId: number }): Promise<ChannelDirectory>;
  getPlayer(): Promise<{
    id: string;
    name: string;
    username: string | null;
    level: number;
    outfit: Outfit;
    stats?: CharacterStats;
  }>;
  getWorld(): Promise<{ regions: readonly RegionDefinition[]; maps: readonly MapDefinition[] }>;
  getMap(input: { regionId: string; mapId: string; instanceId: string }): Promise<Snapshot>;
  getInventory(): Promise<Snapshot>;
  getCharacterInventory(query: CharacterInventoryQuery): Promise<CharacterInventoryPage>;
  execute(command: Command): Promise<CommandResult>;
}

export function validateCommand(command: Command) {
  if (
    !command ||
    typeof command.requestId !== 'string' ||
    !command.requestId ||
    command.requestId.length > 128 ||
    typeof command.mapInstanceId !== 'string' ||
    !command.mapInstanceId
  )
    throw new ApiSdkError('INVALID_COMMAND');
  if (
    (command.type === 'plot' || command.type === 'batch') &&
    command.cropId !== undefined &&
    !Object.hasOwn(FARM_CROPS, command.cropId)
  )
    throw new ApiSdkError('INVALID_COMMAND');
  switch (command.type) {
    case 'plot':
      if (!Number.isSafeInteger(command.index) || command.index < 0) throw new ApiSdkError('INVALID_COMMAND');
      if (!['till', 'sow', 'water', 'harvest', 'buy'].includes(command.action))
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'batch':
      if (!['till', 'sow', 'water', 'harvest', 'buy'].includes(command.action))
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'expand':
    case 'feed':
    case 'collect':
    case 'buy-animal':
      if (!['livestock', 'poultry', 'pond'].includes(command.unit)) throw new ApiSdkError('INVALID_COMMAND');
      if (
        command.type === 'buy-animal' &&
        !['cow', 'pig', 'sheep', 'hen', 'duck', 'fish', 'buffalo', 'turtle', 'dog'].includes(command.species)
      )
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'upgrade-chest':
      if (!['main', 'home'].includes(command.chest)) throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'transfer-goods':
      if (!['main', 'home'].includes(command.from)) throw new ApiSdkError('INVALID_COMMAND');
      if (!Object.hasOwn(FARM_PRODUCTS, command.product) || !Number.isSafeInteger(command.count) || command.count < 1)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'sell':
      if (command.chest !== undefined && !['main', 'home'].includes(command.chest))
        throw new ApiSdkError('INVALID_COMMAND');
      if (!Object.hasOwn(FARM_PRODUCTS, command.product) || !Number.isSafeInteger(command.count) || command.count < 1)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'buy-seeds':
      if (!Object.hasOwn(FARM_CROPS, command.cropId) || !Number.isSafeInteger(command.count) || command.count < 1)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'cook':
      if (!Object.hasOwn(FARM_RECIPES, command.recipeId)) throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'collect-dish':
      if (typeof command.jobId !== 'string' || !command.jobId) throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'sell-animal':
    case 'butcher-animal':
      if (
        !['livestock', 'poultry', 'pond'].includes(command.unit) ||
        typeof command.animalId !== 'string' ||
        !command.animalId
      )
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'buy-cosmetic':
      if (typeof command.offerId !== 'string' || !command.offerId || command.offerId.length > 256)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'move-character-item':
      if (!['bag', 'warehouse'].includes(command.to)) throw new ApiSdkError('INVALID_COMMAND');
      if (typeof command.instanceId !== 'string' || !command.instanceId || command.instanceId.length > 512)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'upgrade-character-item':
      if (
        !['coins', 'gems'].includes(command.currency) ||
        !Number.isSafeInteger(command.recipeVersion) ||
        command.recipeVersion < 1
      )
        throw new ApiSdkError('INVALID_COMMAND');
      if (typeof command.targetId !== 'string' || !command.targetId || command.targetId.length > 256)
        throw new ApiSdkError('INVALID_COMMAND');
      if (typeof command.instanceId !== 'string' || !command.instanceId || command.instanceId.length > 512)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'equip-character-item':
    case 'unequip-character-item':
      if (typeof command.instanceId !== 'string' || !command.instanceId || command.instanceId.length > 512)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'apply-cosmetic-color':
      if (typeof command.cosmeticId !== 'string' || !command.cosmeticId || command.cosmeticId.length > 256)
        throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'equip-outfit':
      if (!command.outfit || typeof command.outfit !== 'object') throw new ApiSdkError('INVALID_COMMAND');
      break;
    case 'feed-all':
    case 'collect-all':
      break;
    default:
      throw new ApiSdkError('INVALID_COMMAND');
  }
}

export function decodeSnapshot(value: unknown): Snapshot {
  const invalid = (): never => {
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid API response');
  };

  if (!value || typeof value !== 'object') return invalid();
  const data = value as Snapshot;
  if (
    typeof data.mapInstanceId !== 'string' ||
    !data.mapInstanceId ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    !Number.isFinite(data.serverTime) ||
    data.serverTime < 0 ||
    !data.outfit ||
    Object.keys(defaultOutfit).some((key) => typeof data.outfit[key as keyof Outfit] !== 'string')
  )
    return invalid();
  const farm = parseFarmProgress(data.farm, invalid);
  return {
    mapInstanceId: data.mapInstanceId,
    revision: data.revision,
    serverTime: data.serverTime,
    farm,
    outfit: sanitizeOutfit(data.outfit),
  };
}

export function decodeCommandResult(value: unknown): CommandResult {
  const snapshot = decodeSnapshot(value);
  const result = value as CommandResult;
  if (
    !Number.isSafeInteger(result.completed) ||
    result.completed < 0 ||
    !Number.isSafeInteger(result.eligible) ||
    result.eligible < 0 ||
    (result.upgrade !== undefined && !validUpgradeResult(result.upgrade))
  )
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid command response');
  return {
    ...snapshot,
    completed: result.completed,
    eligible: result.eligible,
    ...(result.upgrade ? { upgrade: result.upgrade } : {}),
  };
}

export function decodePlayer(value: unknown): Awaited<ReturnType<GameSdk['getPlayer']>> {
  const player = value as Awaited<ReturnType<GameSdk['getPlayer']>>;
  if (
    !player ||
    typeof player.id !== 'string' ||
    typeof player.name !== 'string' ||
    !Number.isSafeInteger(player.level) ||
    player.level < 1 ||
    !player.outfit ||
    Object.keys(defaultOutfit).some((key) => typeof player.outfit[key as keyof Outfit] !== 'string')
  )
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid player response');
  return {
    id: player.id,
    name: player.name,
    username: player.username ?? null,
    level: player.level,
    outfit: sanitizeOutfit(player.outfit),
    ...(player.stats !== undefined ? { stats: decodeCharacterStats(player.stats) } : {}),
  };
}

export function decodeWorld(value: unknown): Awaited<ReturnType<GameSdk['getWorld']>> {
  const world = value as Awaited<ReturnType<GameSdk['getWorld']>>;
  try {
    validateWorld(world);
  } catch {
    throw new ApiSdkError('NETWORK_ERROR', 'Invalid world response');
  }
  return world;
}
