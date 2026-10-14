import { createInstance } from 'i18next';
import { type Locale, resources } from '@/application/i18n/resources';

export function createGameI18n(locale: Locale = 'vi') {
  const instance = createInstance();
  void instance.init({
    resources: structuredClone(resources),
    lng: locale,
    fallbackLng: 'vi',
    supportedLngs: Object.keys(resources),
    defaultNS: 'common',
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
