import i18n, { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAiWizard from './locales/en-US/aiWizard.json';
import enCommon from './locales/en-US/common.json';
import enInspector from './locales/en-US/inspector.json';
import enTour from './locales/en-US/tour.json';
import esAiWizard from './locales/es-419/aiWizard.json';
import esCommon from './locales/es-419/common.json';
import esInspector from './locales/es-419/inspector.json';
import esTour from './locales/es-419/tour.json';
import itAiWizard from './locales/it-IT/aiWizard.json';
import itCommon from './locales/it-IT/common.json';
import itInspector from './locales/it-IT/inspector.json';
import itTour from './locales/it-IT/tour.json';

export const SUPPORTED_LOCALES = ['en-US', 'es-419', 'it-IT'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Map short locale codes to full locale codes
const LOCALE_MAP: Record<string, SupportedLocale> = {
  en: 'en-US',
  'en-US': 'en-US',
  es: 'es-419',
  'es-419': 'es-419',
  it: 'it-IT',
  'it-IT': 'it-IT',
};

/**
 * Normalize a locale string to a supported full locale code.
 * Accepts short codes (en, es, it) or full codes (en-US, es-419, it-IT).
 */
export function normalizeLocale(locale: string | undefined | null): SupportedLocale {
  if (!locale) return 'en-US';
  return LOCALE_MAP[locale] ?? LOCALE_MAP[locale.split('-')[0]] ?? 'en-US';
}

const resources: Resource = {
  // Full locale codes
  'en-US': {
    common: enCommon,
    inspector: enInspector,
    aiWizard: enAiWizard,
    tour: enTour,
  },
  'es-419': {
    common: esCommon,
    inspector: esInspector,
    aiWizard: esAiWizard,
    tour: esTour,
  },
  'it-IT': {
    common: itCommon,
    inspector: itInspector,
    aiWizard: itAiWizard,
    tour: itTour,
  },
  // Short locale codes (same resources, for compatibility with parent apps)
  en: {
    common: enCommon,
    inspector: enInspector,
    aiWizard: enAiWizard,
    tour: enTour,
  },
  es: {
    common: esCommon,
    inspector: esInspector,
    aiWizard: esAiWizard,
    tour: esTour,
  },
  it: {
    common: itCommon,
    inspector: itInspector,
    aiWizard: itAiWizard,
    tour: itTour,
  },
};

// All locale keys we need to register (both short and full)
const ALL_LOCALE_KEYS = ['en-US', 'es-419', 'it-IT', 'en', 'es', 'it'] as const;

// Always add resources to i18next, even if already initialized
// This ensures email-builder translations are available regardless of
// whether the consuming app has its own i18next setup
function addEmailBuilderResources() {
  ALL_LOCALE_KEYS.forEach((lng) => {
    const lngResources = resources[lng];
    if (lngResources) {
      Object.keys(lngResources).forEach((ns) => {
        if (!i18n.hasResourceBundle(lng, ns)) {
          i18n.addResourceBundle(lng, ns, lngResources[ns], true, true);
        }
      });
    }
  });
}

if (i18n.isInitialized) {
  // i18next already initialized by consuming app - just add our resources
  addEmailBuilderResources();
} else {
  // Initialize i18next with our config
  i18n
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en-US',
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: ['common', 'inspector', 'aiWizard', 'tour'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
    })
    .catch(() => {
      // Silently ignore initialization errors
    });
}

/**
 * Change the current locale. Accepts short codes (en, es, it) or full codes.
 */
export const setLocale = async (locale: string) => {
  const normalized = normalizeLocale(locale);
  await i18n.changeLanguage(normalized);
};

export default i18n;
