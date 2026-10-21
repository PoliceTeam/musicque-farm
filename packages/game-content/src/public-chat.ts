import { MAPS } from './world.js';

export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_SEND_INTERVAL = 1000;
export const CHAT_HISTORY_TTL = 60 * 60 * 1000;

/** Only location scenes with channel presence draw remote players. */
export function publicChatArea(regionId: string, mapId: string) {
  const map = MAPS.find((map) => map.regionId === regionId && map.id === mapId);
  if (map?.scene === 'location' && map.channels)
    return { regionId, mapId, label: map.label, channels: map.channels.count };
  return undefined;
}
