import { SocialError } from '@chibi-town/contracts/social';
import type { TFunction } from 'i18next';

export function socialErrorMessage(reason: unknown, t: TFunction<'social'>) {
  return reason instanceof SocialError
    ? t(`errors.${reason.code}`, { seconds: reason.retryAfterSeconds ?? 60 })
    : t('failed');
}
