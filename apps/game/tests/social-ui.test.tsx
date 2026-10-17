import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { decodeFriendList, decodePublicProfile, SocialError } from '@chibi-town/contracts/social';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { CharacterProfile } from '@/features/character/_components/character-profile';
import { FriendActions } from '@/features/social/_components/friend-actions';
import { PlayerInteractionDialog } from '@/features/social/_components/player-interaction-dialog';
import { PlayerRadialMenu } from '@/features/social/_components/player-radial-menu';
import { socialErrorMessage } from '@/features/social/social-error-message';

it.each([
  ['none', ['Kết bạn'], ['Chấp nhận', 'Hủy kết bạn']],
  ['incoming', ['Chấp nhận', 'Từ chối'], ['Kết bạn', 'Hủy lời mời']],
  ['outgoing', ['Hủy lời mời'], ['Chấp nhận', 'Hủy kết bạn']],
  ['friends', ['Hủy kết bạn'], ['Chấp nhận', 'Hủy lời mời']],
] as const)('shows only permitted actions for %s', (state, present, absent) => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <FriendActions state={state} pending onAction={() => {}} />
    </I18nextProvider>,
  );
  for (const label of present) expect(html).toContain(`>${label}</button>`);
  for (const label of absent) expect(html).not.toContain(`>${label}</button>`);
  expect(html).toContain('disabled');
});
it('public character details omit both currencies entirely', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <CharacterProfile publicView player={{ id: 'a', name: 'Bạn', username: null, level: 1, outfit: defaultOutfit }} />
    </I18nextProvider>,
  );
  expect(html).not.toContain('character-wallet');
  expect(html).not.toContain('Lượng');
});
it('rejects malformed successful social HTTP responses and strips private profile fields', () => {
  expect(() => decodeFriendList({ entries: [{ state: 'admin' }] })).toThrow();
  expect(() => decodePublicProfile({ id: 'broken', relationship: 'friends' })).toThrow();
  const player = { id: '00000000-0000-4000-8000-000000000001', name: 'Bạn', level: 1, outfit: defaultOutfit };
  expect(() =>
    decodeFriendList({
      entries: [
        { player, state: 'friends', updatedAt: 1 },
        { player, state: 'friends', updatedAt: 1 },
      ],
    }),
  ).toThrow();
  const profile = decodePublicProfile({
    ...player,
    relationship: 'none',
    stats: { experience: 0, fashion: 0, friendliness: 0, happiness: 0, mischief: 0, health: 0 },
    email: 'private@example.test',
    coins: 100,
  });
  expect(profile).not.toHaveProperty('email');
  expect(profile).not.toHaveProperty('coins');
});

it('opens circular map actions without a modal and reserves the profile dialog for Information', () => {
  const radial = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <PlayerRadialMenu
        id="00000000-0000-4000-8000-000000000001"
        anchor={[300, 300]}
        menuRef={createRef<HTMLDivElement>()}
        onClose={() => {}}
        onInformation={() => {}}
      />
    </I18nextProvider>,
  );
  expect(radial).toContain('role="toolbar"');
  expect(radial.match(/class="radial-disc"/g)).toHaveLength(2);
  expect(radial).not.toContain('<dialog');
  expect(radial).not.toContain('<canvas');
  const details = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <PlayerInteractionDialog id="00000000-0000-4000-8000-000000000001" onClose={() => {}} />
    </I18nextProvider>,
  );
  expect(details).toContain('<dialog');
  expect(details).toContain('Thông tin');
  expect(details).not.toContain('Tương tác');
});

it('explains cooldown separately from the viewer and recipient capacity limits', () => {
  const t = createGameI18n().getFixedT('vi', 'social');
  const cooldown = socialErrorMessage(new SocialError('FRIEND_REQUEST_COOLDOWN', 17), t);
  expect(cooldown).toContain('17 giây');
  expect(cooldown).not.toContain('đầy');
  expect(socialErrorMessage(new SocialError('FRIEND_LIST_FULL'), t)).toContain('Bạn đã có đủ 200');
  expect(socialErrorMessage(new SocialError('TARGET_FRIEND_REQUESTS_FULL'), t)).toContain('Người này đang có 50');
  expect(socialErrorMessage(new Error('network'), t)).not.toContain('đầy');
});
