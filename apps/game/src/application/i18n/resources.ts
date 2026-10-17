import auth from '@/application/i18n/locales/vi/auth';
import common from '@/application/i18n/locales/vi/common';
import farm from '@/application/i18n/locales/vi/farm';
import inventory from '@/application/i18n/locales/vi/inventory';
import settings from '@/application/i18n/locales/vi/settings';
import social from '@/application/i18n/locales/vi/social';

export const resources = { vi: { auth, common, farm, inventory, settings, social } } as const;
export type Locale = keyof typeof resources;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof resources.vi;
    strictKeyChecks: true;
  }
}
