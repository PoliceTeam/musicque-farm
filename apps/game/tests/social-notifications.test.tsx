import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { FriendEntry, FriendList } from '@chibi-town/contracts/social';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { ChatContext } from '@/features/chat/chat-context';
import { FriendsDialog } from '@/features/social/_components/friends-dialog';
import { InboxButton } from '@/features/social/_components/inbox-button';
import { newFriendNotice, noticeTab } from '@/features/social/_utils/friend-notifications';
import { socialClient } from '@/features/social/social-client';
import { SOCIAL_ACTION_EVENT } from '@/features/social/social-events';

const entry = (state: FriendEntry['state'], updatedAt = 1): FriendEntry => ({
  player: { id: '00000000-0000-4000-8000-000000000001', name: 'Bạn A', level: 1, outfit: defaultOutfit },
  state,
  updatedAt,
});

const list = (...entries: FriendEntry[]): FriendList => ({ entries });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('announces new invitations, reopening and accepted outgoing requests without repeating unchanged snapshots', () => {
  expect(newFriendNotice(undefined, list())).toBeUndefined();
  expect(newFriendNotice(undefined, list(entry('incoming')))).toEqual({ kind: 'pending', count: 1 });
  expect(newFriendNotice(list(), list(entry('incoming')))).toEqual({ kind: 'incoming', count: 1, name: 'Bạn A' });
  expect(newFriendNotice(list(entry('incoming')), list(entry('incoming')))).toBeUndefined();
  expect(newFriendNotice(list(entry('incoming')), list(entry('incoming', 2)))?.kind).toBe('incoming');
  expect(newFriendNotice(list(entry('outgoing')), list(entry('friends', 2)))).toEqual({
    kind: 'accepted',
    count: 1,
    name: 'Bạn A',
  });
  expect(newFriendNotice(list(entry('incoming')), list(entry('friends', 2)))).toBeUndefined();
});
it('routes invitation and send notifications directly to their appropriate tab', () => {
  expect(noticeTab({ kind: 'pending', count: 1 })).toBe('incoming');
  expect(noticeTab({ kind: 'action', action: 'request', state: 'outgoing' })).toBe('outgoing');
  expect(noticeTab({ kind: 'action', action: 'request', state: 'incoming' })).toBe('incoming');
  expect(noticeTab({ kind: 'accepted', name: 'Bạn', count: 1 })).toBe('friends');
});
it('shows a persistent accessible inbox count and omits the zero badge', () => {
  const render = (count: number) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={createGameI18n()}>
        <InboxButton count={count} onClick={() => {}} />
      </I18nextProvider>,
    );

  expect(render(2)).toContain('Tin nhắn, 2 lời mời kết bạn chờ xử lý');
  expect(render(2)).toContain('social-inbox-badge');
  expect(render(0)).not.toContain('social-inbox-badge');
});
it('keeps only one close control and opens the requested inbox tab', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <FriendsDialog initialTab="incoming" onClose={() => {}} />
    </I18nextProvider>,
  );
  expect(html).not.toContain('ui-dialog-footer');
  expect(html).toMatch(/aria-selected="true"[^>]*>Lời mời đến<\/button>/);
  expect(html).not.toContain('(0)');
});
it('announces successful send completion exactly once and never announces failed requests', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api');
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  const seen: unknown[] = [];
  target.addEventListener(SOCIAL_ACTION_EVENT, (event) => seen.push((event as CustomEvent).detail));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"relationship":"outgoing"}', { status: 200 })),
  );
  await socialClient.change('00000000-0000-4000-8000-000000000001', 'request');
  expect(seen).toEqual([{ action: 'request', state: 'outgoing' }]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"code":"FRIEND_REQUEST_COOLDOWN","retryAfterSeconds":10}', { status: 409 })),
  );
  await expect(socialClient.change('00000000-0000-4000-8000-000000000001', 'request')).rejects.toMatchObject({
    code: 'FRIEND_REQUEST_COOLDOWN',
  });
  expect(seen).toHaveLength(1);
});

it('includes the community tab only in shared locations, inside the same inbox dialog', () => {
  const render = (shared: boolean) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={createGameI18n()}>
        <ChatContext.Provider
          value={{
            area: shared ? { regionId: 'center', mapId: 'shopping-street' } : undefined,

            setHost() {},
          }}
        >
          <FriendsDialog onClose={() => {}} />
        </ChatContext.Provider>
      </I18nextProvider>,
    );

  expect(render(true)).toContain('Chat khu');
  expect(render(false)).not.toContain('Chat khu');
  expect((render(true).match(/<dialog\b/g) ?? []).length).toBe(1);
});
