import { MAPS } from './world.js';

export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_SEND_INTERVAL = 1000;
export const CHAT_HISTORY_TTL = 60 * 60 * 1000;

/** Public areas without a walkable map still have their own chat, separate from street rooms. */
export function publicChatArea(regionId: string, mapId: string) {
  const map = MAPS.find((map) => map.regionId === regionId && map.id === mapId);
  if (map) return { regionId, mapId, label: map.label, channels: map.channels?.count ?? 1 };
  const virtual = [
    { regionId: 'world', mapId: 'world-map', label: 'Bản đồ' },
    { regionId: 'farm', mapId: 'farm-entrance', label: 'Cổng nông trại' },
    { regionId: 'fun', mapId: 'pet-racing', label: 'Đua thú cưng' },
  ].find((area) => area.regionId === regionId && area.mapId === mapId);
  return virtual && { ...virtual, channels: 1 };
}
