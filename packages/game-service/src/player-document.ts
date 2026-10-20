import {
  type GemBattle,
  type GemBattleSnapshot,
  type GemPublicResult,
  gemBattleSnapshot,
  gemPublicResult,
  isGemBattle,
  isGemBattleSnapshot,
} from '@chibi-town/arcade-games/gem-battle-logic';
import {
  isMiniMatch,
  MINI_GAME_IDS,
  type MiniGameId,
  type MiniMatch,
  type MiniResult,
  type MiniSnapshot,
} from '@chibi-town/arcade-games/mini-games-logic';
import { isPhomMatch, type PhomMatch, type PhomResult, type PhomSnapshot } from '@chibi-town/arcade-games/phom-logic';
import { isTienMatch, type TienMatch, type TienResult } from '@chibi-town/arcade-games/tien-len-logic';
import { ApiSdkError, type Snapshot } from '@chibi-town/contracts';
import { decodeGemResult, validArcadeRequestId } from '@chibi-town/contracts/arcade';
import type { ArcadeTableResult } from '@chibi-town/contracts/arcade-table';
import { decodeArcadeTableResult } from '@chibi-town/contracts/arcade-table';
import { decodeMiniResult, decodeMiniSnapshot } from '@chibi-town/contracts/mini-games';
import { decodePhomResult, decodePhomSnapshot } from '@chibi-town/contracts/phom';
import { decodeTienResult, decodeTienSnapshot } from '@chibi-town/contracts/tien-len';
import { parseFarmProgress } from '@chibi-town/gameplay';
import type { CharacterInventoryState } from './character-inventory.js';
import { pruneReceipts } from './receipt-order.js';
export type PlayerDocument = {
  version: 1;
  upgradeFailures?: Record<string, number>;
  jeweler?: {
    materials: Partial<Record<import('@chibi-town/game-content/jeweler').JewelerMaterialId, number>>;
    receipts: Record<string, string>;
  };
  luckyDraw?: {
    tickets: number;
    receipts: Record<
      string,
      { fingerprint: string; result?: import('@chibi-town/contracts/lucky-draw').LuckyDrawResult }
    >;
  };
  farmTheftHistory?: import('@chibi-town/contracts/farm-social').FarmTheftEntry[];
  petRacing?: {
    bet?: import('@chibi-town/contracts/pet-racing').RaceBet;
    lastRace?: import('@chibi-town/contracts/pet-racing').RaceResult;
    receipts: Record<
      string,
      {
        fingerprint: string;
        bet?: import('@chibi-town/contracts/pet-racing').RaceBet;
        race?: import('@chibi-town/contracts/pet-racing').RaceResult;
      }
    >;
  };
  arcadeBotCoins?: Record<string, number>;
  mini?: Partial<
    Record<
      MiniGameId,
      {
        wins: number;
        activeMatch?: MiniMatch;
        starts: Record<string, { fingerprint: string; match: MiniSnapshot }>;
        requests: Record<string, { fingerprint: string; result: MiniResult }>;
      }
    >
  >;
  arcadeTableRequests?: Record<string, { fingerprint: string; result: ArcadeTableResult }>;
  phom?: {
    wins: number;
    activeMatch?: PhomMatch;
    starts: Record<string, { fingerprint: string; match: PhomSnapshot }>;
    requests: Record<string, { fingerprint: string; result: PhomResult }>;
  };
  tien?: {
    wins: number;
    activeMatch?: TienMatch;
    starts: Record<
      string,
      { fingerprint: string; match: import('@chibi-town/arcade-games/tien-len-logic').TienSnapshot }
    >;
    requests: Record<string, { fingerprint: string; result: TienResult }>;
  };
  arcade?: {
    wins?: number;
    bestScore: number;
    activeBattle?: GemBattle;
    starts: Record<string, { fingerprint: string; battle: GemBattleSnapshot }>;
    requests: Record<string, { fingerprint: string; result: GemPublicResult }>;
  };
  channelSelections?: Record<string, number>;
  /** Stake held per game while the player sits at a started table of people; the match itself lives on the server. */
  tableStakes?: Record<string, number>;
  revision: number;
  farm: Snapshot['farm'];
  outfit?: Snapshot['outfit'];
  characterInventory?: CharacterInventoryState;
  characterSetupPending?: boolean;
  instances?: Record<string, Snapshot['farm']>;
  requests: Record<
    string,
    {
      fingerprint: string;
      result: {
        completed: number;
        eligible: number;
        upgrade?: import('@chibi-town/contracts/character-inventory').CosmeticUpgradeResult;
      };
    }
  >;
};

/** Coins promised to matches still being played; farm commands and new wagers may not spend them. */
export function reservedArcadeCoins(document: PlayerDocument) {
  const matches = [
    document.arcade?.activeBattle,
    document.tien?.activeMatch,
    document.phom?.activeMatch,
    ...Object.values(document.mini ?? {}).map((state) => state?.activeMatch),
  ];
  const local = matches.reduce(
    (sum, match) =>
      sum +
      (match?.status === 'playing' && match.session?.mode === 'wager' && !match.session.settled
        ? match.session.stake
        : 0),
    0,
  );
  return Object.values(document.tableStakes ?? {}).reduce((sum, stake) => sum + stake, local);
}

export function createPlayerDocument(legacy?: unknown): PlayerDocument {
  return { version: 1, revision: 0, farm: parseFarmProgress(legacy), requests: {} };
}

function upgradeArcadeSeat(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const seat = value as { roomId: number; tableId?: number };
  if (seat.tableId === undefined && Number.isSafeInteger(seat.roomId) && seat.roomId >= 0 && seat.roomId < 8) {
    seat.tableId = seat.roomId;
    seat.roomId = 0;
  }
}

function upgradeTienResult(value: unknown) {
  const result = value as TienResult | undefined;
  if (!result || typeof result !== 'object') return;
  upgradeArcadeSeat(result.match);
  if (Array.isArray(result.steps)) for (const step of result.steps) upgradeArcadeSeat(step?.match);
}

/** Repairs or drops fields from older or damaged saves; every repository runs it on read. */
export function normalizePlayerDocument(document: PlayerDocument) {
  if (document.upgradeFailures) {
    document.upgradeFailures = Object.fromEntries(
      Object.entries(
        typeof document.upgradeFailures === 'object' && !Array.isArray(document.upgradeFailures)
          ? document.upgradeFailures
          : {},
      ).filter(
        ([key, count]) => /^(item|pet)\/[-a-z.]+\/[2-6]$/.test(key) && Number.isSafeInteger(count) && count >= 0,
      ),
    );
  }
  if (document.tableStakes) {
    if (typeof document.tableStakes !== 'object' || Array.isArray(document.tableStakes)) delete document.tableStakes;
    else
      for (const [game, stake] of Object.entries(document.tableStakes))
        if (!Number.isSafeInteger(stake) || stake < 0) delete document.tableStakes[game];
  }
  if (
    document.arcadeBotCoins &&
    (typeof document.arcadeBotCoins !== 'object' || Array.isArray(document.arcadeBotCoins))
  )
    document.arcadeBotCoins = {};
  for (const [id, balance] of Object.entries(document.arcadeBotCoins ?? {}))
    if (!/^local-bot-[1-3]$/.test(id) || !Number.isSafeInteger(balance) || balance < 0)
      delete document.arcadeBotCoins![id];
  if (
    !document.arcadeTableRequests ||
    typeof document.arcadeTableRequests !== 'object' ||
    Array.isArray(document.arcadeTableRequests)
  )
    document.arcadeTableRequests = {};
  for (const [key, record] of Object.entries(document.arcadeTableRequests)) {
    try {
      if (!validArcadeRequestId(key) || !record || typeof record.fingerprint !== 'string')
        throw new Error('Invalid request');
      decodeArcadeTableResult(record.result);
    } catch {
      delete document.arcadeTableRequests[key];
    }
  }
  pruneReceipts(document.arcadeTableRequests);
  if (document.mini && (typeof document.mini !== 'object' || Array.isArray(document.mini))) delete document.mini;
  if (document.mini)
    for (const gameId of MINI_GAME_IDS) {
      const state = document.mini[gameId];
      if (!state) continue;
      if (typeof state !== 'object' || Array.isArray(state)) {
        delete document.mini[gameId];
        continue;
      }
      if (!Number.isSafeInteger(state.wins) || state.wins < 0) state.wins = 0;
      if (!isMiniMatch(state.activeMatch) || state.activeMatch.gameId !== gameId) delete state.activeMatch;
      for (const field of ['starts', 'requests'] as const) {
        if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) state[field] = {};
        for (const [requestId, record] of Object.entries(state[field]))
          try {
            if (!validArcadeRequestId(requestId) || !record || typeof record.fingerprint !== 'string')
              throw new Error('Invalid request');
            const match =
              field === 'starts'
                ? decodeMiniSnapshot(state.starts[requestId].match)
                : decodeMiniResult(state.requests[requestId].result).match;
            if (match.gameId !== gameId) throw new Error('Wrong game');
          } catch {
            delete state[field][requestId];
          }
        pruneReceipts(state[field]);
      }
    }
  if (document.phom) {
    if (typeof document.phom !== 'object' || Array.isArray(document.phom)) delete document.phom;
    else {
      const state = document.phom;
      if (!Number.isSafeInteger(state.wins) || state.wins < 0) state.wins = 0;

      if (!isPhomMatch(state.activeMatch)) delete state.activeMatch;
      for (const field of ['starts', 'requests'] as const) {
        if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) state[field] = {};
        for (const [key, record] of Object.entries(state[field])) {
          try {
            if (!validArcadeRequestId(key) || !record || typeof record.fingerprint !== 'string')
              throw new Error('Invalid request');
            if (field === 'starts') {
              decodePhomSnapshot(state.starts[key].match);
            } else {
              decodePhomResult(state.requests[key].result);
            }
          } catch {
            delete state[field][key];
          }
        }
        pruneReceipts(state[field]);
      }
    }
  }
  if (document.tien) {
    if (typeof document.tien !== 'object' || Array.isArray(document.tien)) delete document.tien;
    else {
      const state = document.tien;
      if (!Number.isSafeInteger(state.wins) || state.wins < 0) state.wins = 0;
      upgradeArcadeSeat(state.activeMatch);
      if (!isTienMatch(state.activeMatch)) delete state.activeMatch;
      for (const field of ['starts', 'requests'] as const) {
        if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) state[field] = {};
        for (const [key, record] of Object.entries(state[field])) {
          try {
            if (!validArcadeRequestId(key) || !record || typeof record.fingerprint !== 'string')
              throw new Error('Invalid request');
            if (field === 'starts') {
              upgradeArcadeSeat(state.starts[key].match);
              decodeTienSnapshot(state.starts[key].match);
            } else {
              upgradeTienResult(state.requests[key].result);
              decodeTienResult(state.requests[key].result);
            }
          } catch {
            delete state[field][key];
          }
        }
        pruneReceipts(state[field]);
      }
    }
  }
  if (document.arcade && (typeof document.arcade !== 'object' || Array.isArray(document.arcade)))
    delete document.arcade;
  if (document.arcade) {
    if (!Number.isSafeInteger(document.arcade.bestScore) || document.arcade.bestScore < 0)
      document.arcade.bestScore = 0;
    upgradeArcadeSeat(document.arcade.activeBattle);
    if (!isGemBattle(document.arcade.activeBattle)) delete document.arcade.activeBattle;
    const state = document.arcade;
    if (!state.starts || typeof state.starts !== 'object' || Array.isArray(state.starts)) state.starts = {};
    if (!state.requests || typeof state.requests !== 'object' || Array.isArray(state.requests)) state.requests = {};
    for (const [key, record] of Object.entries(state.starts)) {
      upgradeArcadeSeat(record?.battle);
      if (
        !validArcadeRequestId(key) ||
        !record ||
        typeof record.fingerprint !== 'string' ||
        !isGemBattleSnapshot(record.battle)
      )
        delete state.starts[key];
      else record.battle = gemBattleSnapshot(record.battle);
    }
    for (const [key, record] of Object.entries(state.requests)) {
      try {
        if (!validArcadeRequestId(key) || !record || typeof record.fingerprint !== 'string')
          throw new Error('Invalid request');
        upgradeArcadeSeat(record.result?.battle);
        decodeGemResult(record.result);
        record.result = gemPublicResult(record.result);
      } catch {
        delete state.requests[key];
      }
    }
    for (const records of [state.starts, state.requests]) pruneReceipts(records);
  }
  if (document.channelSelections) {
    const entries =
      typeof document.channelSelections === 'object' && !Array.isArray(document.channelSelections)
        ? Object.entries(document.channelSelections)
        : [];
    document.channelSelections = Object.fromEntries(
      entries.filter(
        ([key, value]) =>
          /^[-a-zA-Z0-9_]{1,80}$/.test(key) && Number.isSafeInteger(value) && value >= 0 && value < 1000,
      ),
    );
  }
  document.farm = parseFarmProgress(document.farm);
  // The farm now has one warehouse. Preserve stock and the highest paid level.
  for (const [id, count] of Object.entries(document.farm.homeInventory)) {
    const product = id as keyof typeof document.farm.homeInventory;
    const total = (document.farm.inventory[product] ?? 0) + (count ?? 0);
    if (!Number.isSafeInteger(total)) throw new ApiSdkError('STORAGE_UNAVAILABLE');
    document.farm.inventory[product] = total;
  }
  document.farm.homeInventory = {};
  document.farm.chests.main = Math.max(
    document.farm.chests.main,
    document.farm.chests.home,
  ) as typeof document.farm.chests.main;
  if (document.instances)
    for (const [id, farm] of Object.entries(document.instances)) document.instances[id] = parseFarmProgress(farm);
  return document;
}
