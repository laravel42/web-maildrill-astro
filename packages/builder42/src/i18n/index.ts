/**
 * i18n del editor — setup de i18next (docs/12-i18n §A).
 *
 * Traducciones estáticas (importadas en build, sin backend HTTP). El idioma del
 * editor se persiste en `localStorage` y es independiente del idioma del sitio
 * publicado.
 *
 * Modo embebido (docs/52 F7, D7): este módulo también inicializa el
 * **singleton global** (`i18n.use(initReactI18next).init(...)` de más abajo),
 * consumido por `main.tsx` (standalone) a través del import de efecto lateral
 * `import "./i18n"`. `Builder42Editor` (modo embebido) NO importa este
 * side-effect: usa `createEditorI18n()` para una instancia propia con
 * `<I18nextProvider>` — el host (`web-maildrill-astro`) ya tiene su propio
 * i18next inicializado (`email-builder-standalone`) y dos inicializaciones
 * del singleton global se pisarían entre sí.
 */

import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { readConfig } from "@/hooks/useLocalConfig";

// --- ES (español — default) -------------------------------------------------
import esHeader from "./locales/es/header.json";
import esSidebar from "./locales/es/sidebar.json";
import esInspector from "./locales/es/inspector.json";
import esTokens from "./locales/es/tokens.json";
import esCanvas from "./locales/es/canvas.json";
import esCommon from "./locales/es/common.json";
import esTour from "./locales/es/tour.json";

// --- EN (inglés) -------------------------------------------------------------
import enHeader from "./locales/en/header.json";
import enSidebar from "./locales/en/sidebar.json";
import enInspector from "./locales/en/inspector.json";
import enTokens from "./locales/en/tokens.json";
import enCanvas from "./locales/en/canvas.json";
import enCommon from "./locales/en/common.json";
import enTour from "./locales/en/tour.json";

// --- IT (italiano) -----------------------------------------------------------
import itHeader from "./locales/it/header.json";
import itSidebar from "./locales/it/sidebar.json";
import itInspector from "./locales/it/inspector.json";
import itTokens from "./locales/it/tokens.json";
import itCanvas from "./locales/it/canvas.json";
import itCommon from "./locales/it/common.json";
import itTour from "./locales/it/tour.json";

export const SUPPORTED_LANGS = ["es", "en", "it"] as const;
export type EditorLang = (typeof SUPPORTED_LANGS)[number];

const I18N_RESOURCES = {
  es: { header: esHeader, sidebar: esSidebar, inspector: esInspector, tokens: esTokens, canvas: esCanvas, common: esCommon, tour: esTour },
  en: { header: enHeader, sidebar: enSidebar, inspector: enInspector, tokens: enTokens, canvas: enCanvas, common: enCommon, tour: enTour },
  it: { header: itHeader, sidebar: itSidebar, inspector: itInspector, tokens: itTokens, canvas: itCanvas, common: itCommon, tour: itTour },
};

const I18N_NAMESPACES = ["header", "sidebar", "inspector", "tokens", "canvas", "common", "tour"];

/**
 * Crea una instancia de i18next AISLADA del singleton global — usada por
 * `Builder42Editor` (modo embebido, D7) vía `i18next.createInstance()` +
 * `<I18nextProvider>`. `initialLang` es la prop `locale` del editor (idioma
 * del CHROME, no el `editingLocale` de contenido — docs/12 §B, tabla).
 */
export function createEditorI18n(initialLang?: string): I18nInstance {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    resources: I18N_RESOURCES,
    lng: initialLang ?? "es",
    fallbackLng: "es",
    ns: I18N_NAMESPACES,
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React ya escapa
  });
  return instance;
}

void i18n.use(initReactI18next).init({
  resources: I18N_RESOURCES,
  lng: readConfig("editorLang"),
  fallbackLng: "es",
  ns: I18N_NAMESPACES,
  defaultNS: "common",
  interpolation: { escapeValue: false }, // React ya escapa
});

export default i18n;
