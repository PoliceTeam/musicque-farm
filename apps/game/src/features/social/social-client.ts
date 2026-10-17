import { ApiSdkError } from '@chibi-town/contracts';
import {
  decodeFriendList,
  decodePublicProfile,
  type FriendAction,
  type FriendState,
  SOCIAL_ERROR_CODES,
  SocialError,
  type SocialErrorCode,
} from '@chibi-town/contracts/social';
import { AUTH_REQUIRED_EVENT } from '@/application/auth-client';
import { announceSocialAction } from '@/features/social/social-events';

async function request(path: string, body?: unknown) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new ApiSdkError('NETWORK_ERROR');
  let response: Response;
  let data: unknown;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/social${path}`, {
      credentials: 'include',
      method: body ? 'POST' : 'GET',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    data = await response.json();
  } catch {
    throw new ApiSdkError('NETWORK_ERROR');
  }
  if (response.status === 401) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  if (
    !response.ok &&
    data &&
    typeof data === 'object' &&
    'code' in data &&
    SOCIAL_ERROR_CODES.includes(data.code as SocialErrorCode)
  ) {
    const seconds =
      'retryAfterSeconds' in data &&
      Number.isSafeInteger(data.retryAfterSeconds) &&
      Number(data.retryAfterSeconds) > 0 &&
      Number(data.retryAfterSeconds) <= 60
        ? Number(data.retryAfterSeconds)
        : undefined;
    throw new SocialError(data.code as SocialErrorCode, seconds);
  }
  if (!response.ok)
    throw new ApiSdkError(
      response.status === 409 ? 'REQUEST_CONFLICT' : response.status === 403 ? 'NOT_ALLOWED' : 'NETWORK_ERROR',
    );
  return data;
}

export const socialClient = {
  async list() {
    return decodeFriendList(await request('/friends'));
  },

  async profile(id: string) {
    return decodePublicProfile(await request(`/players/${encodeURIComponent(id)}`));
  },

  async change(targetId: string, action: FriendAction) {
    const value = (await request('/friends', { targetId, action })) as { relationship: FriendState };
    if (!value || !['none', 'incoming', 'outgoing', 'friends'].includes(value.relationship))
      throw new ApiSdkError('NETWORK_ERROR');
    announceSocialAction({ action, state: value.relationship });
    return value.relationship;
  },
};
