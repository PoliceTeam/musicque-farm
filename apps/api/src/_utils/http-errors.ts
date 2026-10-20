import type { SdkErrorCode } from '@chibi-town/contracts';

export type AuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_INPUT'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'USERNAME_IMMUTABLE'
  | 'RENAME_TOO_SOON'
  | 'TOO_MANY_ATTEMPTS'
  | 'PROVIDER_UNAVAILABLE';
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AuthErrorCode,
    public readonly nextAllowedAt?: number,
  ) {
    super(code);
    this.name = 'HttpError';
  }
}

const statuses: Partial<Record<SdkErrorCode, number>> = {
  NOT_ALLOWED: 403,
  ACCOUNT_REQUIRED: 403,
  MAP_NOT_FOUND: 404,
  NO_MATCH: 404,
  REQUEST_CONFLICT: 409,
  MATCH_IN_PROGRESS: 409,
  MATCH_FINISHED: 409,
  CHANNEL_FULL: 409,
  INVENTORY_FULL: 409,
  INSUFFICIENT_COINS: 409,
  INSUFFICIENT_GEMS: 409,
  NOT_ENOUGH_MATERIALS: 409,
  NOT_ENOUGH_MANA: 409,
  STORAGE_UNAVAILABLE: 503,
  NETWORK_ERROR: 503,
};

/** Invalid commands, moves and turns are client errors. */
export function sdkErrorStatus(code: SdkErrorCode) {
  return statuses[code] ?? 400;
}
