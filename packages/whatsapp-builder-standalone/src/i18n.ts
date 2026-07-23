import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enWaInspector from './locales/en-US/waInspector.json';
import esWaInspector from './locales/es-419/waInspector.json';
import itWaInspector from './locales/it-IT/waInspector.json';

/**
 * Shares the app-wide i18next singleton exactly like the email builder:
 * if a host (or the email builder itself) already initialized i18next,
 * we only add our bundles. The namespace is `waInspector` — distinct
 * from the email builder's `inspector` so the two packages never
 * clobber each other's resources.
 */

export const SUPPORTED_LOCALES = ['en-US', 'es-419', 'it-IT'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_MAP: Record<string, SupportedLocale> = {
  en: 'en-US',
  'en-US': 'en-US',
  es: 'es-419',
  'es-419': 'es-419',
  it: 'it-IT',
  'it-IT': 'it-IT',
};

export function normalizeLocale(locale: string | undefined | null): SupportedLocale {
  if (!locale) return 'en-US';
  return LOCALE_MAP[locale] ?? LOCALE_MAP[locale.split('-')[0]] ?? 'en-US';
}

const resources: Resource = {
  'en-US': { waInspector: enWaInspector },
  'es-419': { waInspector: esWaInspector },
  'it-IT': { waInspector: itWaInspector },
  en: { waInspector: enWaInspector },
  es: { waInspector: esWaInspector },
  it: { waInspector: itWaInspector },
};

const ALL_LOCALE_KEYS = ['en-US', 'es-419', 'it-IT', 'en', 'es', 'it'] as const;

function addWhatsAppBuilderResources() {
  ALL_LOCALE_KEYS.forEach((lng) => {
    const lngResources = resources[lng];
    if (!lngResources) return;
    Object.keys(lngResources).forEach((ns) => {
      if (!i18n.hasResourceBundle(lng, ns)) {
        i18n.addResourceBundle(lng, ns, (lngResources as Record<string, object>)[ns], true, true);
      }
    });
  });
}

if (i18n.isInitialized) {
  addWhatsAppBuilderResources();
} else {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en-US',
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: ['waInspector'],
      defaultNS: 'waInspector',
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    .catch(() => {
      // Silently ignore initialization errors (same policy as email builder).
    });
}

export const setLocale = async (locale: string) => {
  await i18n.changeLanguage(normalizeLocale(locale));
};

export default i18n;
