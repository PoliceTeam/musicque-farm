import { CHAT_MAX_LENGTH } from '@chibi-town/game-content/public-chat';

export type ChatArea = { regionId: string; mapId: string };
export type ChatScope = ChatArea & { channelId: number };
export type ChatMessage = {
  id: string;
  playerId: string;
  name: string;
  level: number;
  text: string;
  sentAt: number;
};
export type ChatFailure = 'NOT_READY' | 'TOO_FAST' | 'CONFLICT';
export type ChatEvent =
  | { type: 'chat.state'; scope: ChatScope; messages: ChatMessage[] }
  | { type: 'chat.message'; scope: ChatScope; message: ChatMessage }
  | { type: 'chat.result'; requestId: string; messageId: string | null; error: ChatFailure | null };
export type ChatCommand =
  | ({ type: 'chat.watch' } & ChatArea)
  | { type: 'chat.leave' }
  | { type: 'chat.send'; requestId: string; text: string };

export function normalizeChatText(value: string) {
  return [...value.normalize('NFC')]
    .map((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
        ? ' '
        : character;
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function validChatText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= CHAT_MAX_LENGTH * 2 &&
    value === normalizeChatText(value) &&
    value.length > 0 &&
    [...value].length <= CHAT_MAX_LENGTH
  );
}

export function validChatScope(value: ChatScope) {
  return (
    !!value &&
    [value.regionId, value.mapId].every((id) => typeof id === 'string' && /^[-a-zA-Z0-9_]{1,80}$/.test(id)) &&
    Number.isSafeInteger(value.channelId) &&
    value.channelId >= 0 &&
    value.channelId < 1000
  );
}

export function validChatMessage(value: ChatMessage) {
  return (
    !!value &&
    typeof value.id === 'string' &&
    /^[-a-zA-Z0-9_:]{1,200}$/.test(value.id) &&
    typeof value.playerId === 'string' &&
    /^[-a-zA-Z0-9_]{1,80}$/.test(value.playerId) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    value.name.length <= 40 &&
    Number.isSafeInteger(value.level) &&
    value.level >= 1 &&
    validChatText(value.text) &&
    Number.isSafeInteger(value.sentAt) &&
    value.sentAt >= 0
  );
}
