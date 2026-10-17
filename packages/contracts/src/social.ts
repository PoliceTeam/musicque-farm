import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit, sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { type CharacterStats, decodeCharacterStats } from './character-stats.js';
import { ApiSdkError } from './index.js';

export type FriendState = 'none' | 'incoming' | 'outgoing' | 'friends';
export type FriendAction = 'request' | 'accept' | 'decline' | 'cancel' | 'remove';
export type SocialPlayer = { id: string; name: string; level: number; outfit: Outfit };
export type FriendEntry = { player: SocialPlayer; state: Exclude<FriendState, 'none'>; updatedAt: number };
export type FriendList = { entries: FriendEntry[] };
export type PublicProfile = SocialPlayer & { stats: CharacterStats; relationship: FriendState };

export const isPlayerId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

function decodeSocialPlayer(value: unknown): SocialPlayer {
  const p = value as SocialPlayer;
  if (
    !p ||
    !isPlayerId(p.id) ||
    typeof p.name !== 'string' ||
    p.name.length > 40 ||
    !Number.isSafeInteger(p.level) ||
    p.level < 1 ||
    !p.outfit ||
    Object.keys(defaultOutfit).some((key) => typeof p.outfit[key as keyof Outfit] !== 'string')
  )
    throw new ApiSdkError('NETWORK_ERROR');
  return { id: p.id, name: p.name, level: p.level, outfit: sanitizeOutfit(p.outfit) };
}

export function decodeFriendList(value: unknown): FriendList {
  const list = value as FriendList;
  if (!list || !Array.isArray(list.entries) || list.entries.length > 1000) throw new ApiSdkError('NETWORK_ERROR');
  const entries = list.entries.map((entry) => {
    if (
      !entry ||
      !['incoming', 'outgoing', 'friends'].includes(entry.state) ||
      !Number.isSafeInteger(entry.updatedAt) ||
      entry.updatedAt < 0
    )
      throw new ApiSdkError('NETWORK_ERROR');
    return { player: decodeSocialPlayer(entry.player), state: entry.state, updatedAt: entry.updatedAt };
  });
  if (new Set(entries.map((entry) => entry.player.id)).size !== entries.length) throw new ApiSdkError('NETWORK_ERROR');
  return { entries };
}

export function decodePublicProfile(value: unknown): PublicProfile {
  const p = value as PublicProfile;
  if (!p || !['none', 'incoming', 'outgoing', 'friends'].includes(p.relationship))
    throw new ApiSdkError('NETWORK_ERROR');
  return { ...decodeSocialPlayer(p), stats: decodeCharacterStats(p.stats), relationship: p.relationship };
}

export const SOCIAL_ERROR_CODES = [
  'FRIEND_REQUEST_COOLDOWN',
  'FRIEND_LIST_FULL',
  'TARGET_FRIEND_LIST_FULL',
  'FRIEND_REQUESTS_FULL',
  'TARGET_FRIEND_REQUESTS_FULL',
] as const;
export type SocialErrorCode = (typeof SOCIAL_ERROR_CODES)[number];
export class SocialError extends Error {
  constructor(
    public readonly code: SocialErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'SocialError';
  }
}
