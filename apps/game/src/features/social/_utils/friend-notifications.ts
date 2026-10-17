import type { FriendAction, FriendList, FriendState } from '@chibi-town/contracts/social';
export type SocialNotice =
  | { kind: 'incoming'; name: string; count: number }
  | { kind: 'accepted'; name: string; count: number }
  | { kind: 'pending'; count: number }
  | { kind: 'action'; action: FriendAction; state: FriendState };
export type SocialTab = 'friends' | 'incoming' | 'outgoing';

export function newFriendNotice(previous: FriendList | undefined, next: FriendList): SocialNotice | undefined {
  const incoming = next.entries.filter((entry) => entry.state === 'incoming');
  if (!previous) return incoming.length ? { kind: 'pending', count: incoming.length } : undefined;
  const known = new Map(previous.entries.map((entry) => [entry.player.id, entry]));
  const fresh = incoming.filter((entry) => {
    const before = known.get(entry.player.id);
    return !before || before.state !== 'incoming' || before.updatedAt !== entry.updatedAt;
  });
  if (fresh.length) return { kind: 'incoming', name: fresh[0].player.name, count: fresh.length };
  const accepted = next.entries.filter(
    (entry) => entry.state === 'friends' && known.get(entry.player.id)?.state === 'outgoing',
  );
  if (accepted.length) return { kind: 'accepted', name: accepted[0].player.name, count: accepted.length };
}

export function noticeTab(notice: SocialNotice): SocialTab {
  if (notice.kind === 'incoming' || notice.kind === 'pending') return 'incoming';
  if (notice.kind === 'accepted') return 'friends';
  return notice.action === 'request'
    ? notice.state === 'incoming'
      ? 'incoming'
      : notice.state === 'friends'
        ? 'friends'
        : 'outgoing'
    : 'friends';
}
