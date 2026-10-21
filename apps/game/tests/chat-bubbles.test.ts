import { expect, it } from 'vitest';
import { bubbleText, type ChatBubbles, expireBubbles, queueBubble } from '@/features/chat/_utils/chat-bubbles';

it('replaces by sender, ignores duplicate delivery, expires at exactly five seconds and keeps peers', () => {
  const bubbles: ChatBubbles = new Map();
  const message = { id: 'a:1', playerId: 'a', name: 'A', level: 1, text: 'Xin chào', sentAt: 0 };
  queueBubble(bubbles, message, 100);
  queueBubble(bubbles, message, 1000);
  expect(bubbles.get('a')?.expiresAt).toBe(5100);
  queueBubble(bubbles, { ...message, id: 'b:1', playerId: 'b' }, 1000);
  queueBubble(bubbles, { ...message, id: 'a:2', text: 'Tin mới' }, 2000);
  expect(bubbles.get('a')?.text).toBe('Tin mới');
  expireBubbles(bubbles, 6000);
  expect([...bubbles.keys()]).toEqual(['a']);
  expireBubbles(bubbles, 7000);
  expect(bubbles.size).toBe(0);
});

it('wraps and clips Unicode to three lines, retaining HTML as plain text', () => {
  const text = bubbleText('😀'.repeat(100));
  expect(text.split('\n').map((line) => [...line].length)).toEqual([28, 28, 28]);
  expect(text.endsWith('…')).toBe(true);
  expect(bubbleText('<img onerror=alert(1)>')).toBe('<img onerror=alert(1)>');
  expect(bubbleText('  Xin\nchào  ')).toBe('Xin chào');
});
