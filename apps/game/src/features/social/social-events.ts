import type { FriendAction, FriendState } from '@chibi-town/contracts/social';
export const SOCIAL_ACTION_EVENT = 'chibi-social-action-complete';
export type SocialActionDetail = { action: FriendAction; state: FriendState };

export function announceSocialAction(detail: SocialActionDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SOCIAL_ACTION_EVENT, { detail }));
}
