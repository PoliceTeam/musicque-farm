import { createInstance, type i18n } from 'i18next';
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
    react: { useSuspense: false, bindI18nStore: 'added' },
  });
  return instance;
}

/** Fast Refresh keeps the mounted instance, so merge newly loaded locale keys into its resource store. */
export function refreshGameI18nResources(instance: i18n) {
  for (const [locale, namespaces] of Object.entries(resources))
    for (const [namespace, messages] of Object.entries(namespaces))
      instance.addResourceBundle(locale, namespace, structuredClone(messages), true, true);
}
