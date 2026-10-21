import type { ChatArea, ChatMessage, ChatScope } from '@chibi-town/contracts/public-chat';
import type { MapDefinition } from '@chibi-town/game-content';
import { CHAT_HISTORY_LIMIT, publicChatArea } from '@chibi-town/game-content/public-chat';

export function chatAreaForScreen(path: string, definition?: MapDefinition): ChatArea | undefined {
  const pathname = path.split('?')[0];
  const parts = pathname.split('/');
  const area = definition
    ? publicChatArea(definition.regionId, definition.id)
    : parts[1] === 'play'
      ? publicChatArea(parts[2], parts[3])
      : undefined;
  if (area) return { regionId: area.regionId, mapId: area.mapId };
  return undefined;
}

export function sameChatScope(a: ChatScope, b: ChatScope) {
  return a.regionId === b.regionId && a.mapId === b.mapId && a.channelId === b.channelId;
}

export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const unique = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()].sort((a, b) => a.sentAt - b.sentAt).slice(-CHAT_HISTORY_LIMIT);
}

/** Space keeps its normal action in editable controls, buttons, links and modal dialogs. */
export function opensPublicChat(
  event: Pick<
    KeyboardEvent,
    'code' | 'key' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'defaultPrevented'
  >,
  interactive: boolean,
  modal: boolean,
) {
  return (
    (event.code === 'Space' || event.key === ' ') &&
    !event.repeat &&
    !event.isComposing &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.defaultPrevented &&
    !interactive &&
    !modal
  );
}
