import type { ChatMessage } from '@chibi-town/contracts/public-chat';

export const BUBBLE_LIFETIME = 5000;
export type ChatBubble = { id: string; text: string; expiresAt: number };
export type ChatBubbles = Map<string, ChatBubble>;

/** Bounded Unicode text, including long unbroken words; Phaser receives plain text. */
export function bubbleText(text: string) {
  const chars = [...text.replace(/\s+/gu, ' ').trim()];
  const clipped = chars.length > 84 ? [...chars.slice(0, 83), '…'] : chars;
  const lines: string[] = [];
  while (clipped.length) lines.push(clipped.splice(0, 28).join(''));
  return lines.join('\n');
}

export function expireBubbles(bubbles: ChatBubbles, now: number) {
  for (const [id, bubble] of bubbles) if (bubble.expiresAt <= now) bubbles.delete(id);
}

export function queueBubble(bubbles: ChatBubbles, message: ChatMessage, now: number) {
  expireBubbles(bubbles, now);
  if (bubbles.get(message.playerId)?.id === message.id) return;
  const text = bubbleText(message.text);
  if (!text) return;
  bubbles.set(message.playerId, { id: message.id, text, expiresAt: now + BUBBLE_LIFETIME });
  if (bubbles.size > 100) bubbles.delete(bubbles.keys().next().value!);
}
