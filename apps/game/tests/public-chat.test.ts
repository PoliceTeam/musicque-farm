import { createRealtimeClient } from '@chibi-town/api-sdk';
import { type ChatMessage, normalizeChatText, validChatText } from '@chibi-town/contracts/public-chat';
import { decodeRealtimeCommand, decodeRealtimeEvent } from '@chibi-town/contracts/realtime';
import { MAPS } from '@chibi-town/game-content';
import { publicChatArea } from '@chibi-town/game-content/public-chat';
import { expect, it } from 'vitest';
import { chatAreaForScreen, mergeChatMessages, opensPublicChat, sameChatScope } from '@/features/chat/_utils/chat-area';

it('validates bounded Vietnamese/emoji chat, strips forged identity and treats text as plain content', () => {
  expect(normalizeChatText('  Xin\nchào\u202e bạn 👋  ')).toBe('Xin chào bạn 👋');
  expect(validChatText('😀'.repeat(200))).toBe(true);
  expect(validChatText('😀'.repeat(201))).toBe(false);
  expect(decodeRealtimeCommand({ type: 'chat.send', requestId: 'msg', text: 'Xin chào', name: 'fake' })).toEqual({
    type: 'chat.send',
    requestId: 'msg',
    text: 'Xin chào',
  });
  expect(decodeRealtimeCommand({ type: 'chat.send', requestId: '__proto__', text: '' })).toBeUndefined();
  expect(decodeRealtimeCommand({ type: 'chat.send', requestId: 'msg', text: '\nspam' })).toBeUndefined();
  const message: ChatMessage = {
    id: 'player:msg',
    playerId: 'player',
    name: 'Người chơi',
    level: 1,
    text: '<img src=x onerror=alert(1)>',
    sentAt: 1,
  };
  expect(
    decodeRealtimeEvent({
      type: 'chat.message',
      scope: { regionId: 'farm', mapId: 'farm-home', channelId: 0 },
      message,
    }),
  ).toBeDefined();
  expect(
    decodeRealtimeEvent({
      type: 'chat.state',
      scope: { regionId: 'farm', mapId: 'farm-home', channelId: 0 },
      messages: Array(51).fill(message),
    }),
  ).toBeUndefined();
});

it('opens only on a deliberate Space outside controls, IME and modal dialogs', () => {
  const space = {
    code: 'Space',
    key: ' ',
    repeat: false,
    isComposing: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    defaultPrevented: false,
  };
  expect(opensPublicChat(space, false, false)).toBe(true);
  for (const patch of [
    { repeat: true },
    { isComposing: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { defaultPrevented: true },
    { code: 'Enter', key: 'Enter' },
  ])
    expect(opensPublicChat({ ...space, ...patch }, false, false)).toBe(false);
  expect(opensPublicChat(space, true, false)).toBe(false);
  expect(opensPublicChat(space, false, true)).toBe(false);
});

it('allows only location maps with remote channel presence and deduplicates bounded history', () => {
  for (const map of MAPS) {
    const allowed = map.scene === 'location' && !!map.channels;
    expect(!!publicChatArea(map.regionId, map.id)).toBe(allowed);
    expect(!!chatAreaForScreen(`/play/${map.regionId}/${map.id}`, map)).toBe(allowed);
  }
  for (const path of ['/', '/map', '/map.html', '/farm', '/farm/home', '/arcade', '/play/fun/pet-racing', '/character'])
    expect(chatAreaForScreen(path)).toBeUndefined();
  const messages = Array.from({ length: 55 }, (_, n) => ({
    id: `player:${n}`,
    playerId: 'player',
    name: 'Tên',
    level: 1,
    text: String(n),
    sentAt: n,
  }));
  expect(mergeChatMessages(messages.slice(0, 50), messages.slice(40))).toEqual(messages.slice(5));
  expect(
    sameChatScope({ regionId: 'fun', mapId: 'a', channelId: 0 }, { regionId: 'fun', mapId: 'a', channelId: 1 }),
  ).toBe(false);
});

it('replays only the chat subscription after reconnect, never resends a message automatically', () => {
  const sockets: any[] = [];
  const retries: (() => void)[] = [];
  const client = createRealtimeClient({
    url: 'ws://test',

    open: () => {
      const s = {
        readyState: 0,

        send: (data: string) => s.sent.push(JSON.parse(data)),

        sent: [] as any[],

        close() {},

        onopen: undefined as any,
        onclose: undefined as any,
        onmessage: undefined as any,
      };
      sockets.push(s);
      return s;
    },

    schedule: (task) => retries.push(task),
  });
  client.send({ type: 'chat.watch', regionId: 'center', mapId: 'shopping-street' });
  sockets[0].readyState = 1;
  sockets[0].onopen();
  client.send({ type: 'chat.send', requestId: 'once', text: 'Xin chào' });
  sockets[0].onclose();
  retries[0]();
  sockets[1].readyState = 1;
  sockets[1].onopen();
  expect(sockets[1].sent).toEqual([{ type: 'chat.watch', regionId: 'center', mapId: 'shopping-street' }]);
  client.send({ type: 'chat.leave' });
  sockets[1].onclose();
  retries[1]();
  sockets[2].readyState = 1;
  sockets[2].onopen();
  expect(sockets[2].sent).toEqual([]);
  client.close();
});
