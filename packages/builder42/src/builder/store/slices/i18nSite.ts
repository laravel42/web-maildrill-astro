/**
 * i18n del sitio (docs/12 §B.4, panel de configuración). Activar/desactivar
 * multilenguaje y gestionar los locales habilitados en `site.meta.i18n`.
 */
import type { SliceCreator } from "./types";

export interface I18nSiteSlice {
  /** Activa multilenguaje: crea `site.meta.i18n` con `[defaultLang]` como único locale. */
  enableSiteI18n: () => void;
  /** Vuelve el sitio monolingüe: borra `site.meta.i18n` (las `translations` quedan huérfanas pero inertes). */
  disableSiteI18n: () => void;
  /** Agrega un locale habilitado (no-op si ya existe o si i18n no está activo). */
  addSiteLocale: (locale: string) => void;
  /** Quita un locale habilitado (no se puede quitar el defaultLocale). */
  removeSiteLocale: (locale: string) => void;
  /** Cambia el idioma por defecto del sitio (debe ser uno de los locales habilitados). */
  setDefaultLocale: (locale: string) => void;
}

export const createI18nSiteSlice: SliceCreator<I18nSiteSlice> = (set) => ({
  enableSiteI18n: () =>
    set((s) => {
      if (s.site.meta.i18n) return; // ya activo, no-op
      s.site.meta.i18n = {
        locales: [s.site.meta.defaultLang],
        defaultLocale: s.site.meta.defaultLang,
        routeStrategy: "prefix-except-default",
      };
    }),

  disableSiteI18n: () =>
    set((s) => {
      delete s.site.meta.i18n;
    }),

  addSiteLocale: (locale) =>
    set((s) => {
      const i18n = s.site.meta.i18n;
      const code = locale.trim().toLowerCase();
      if (!i18n || code === "" || i18n.locales.includes(code)) return;
      i18n.locales.push(code);
    }),

  removeSiteLocale: (locale) =>
    set((s) => {
      const i18n = s.site.meta.i18n;
      if (!i18n || locale === i18n.defaultLocale) return; // no se quita el default
      i18n.locales = i18n.locales.filter((l) => l !== locale);
      // El editingLocale global no puede quedar apuntando a un locale ya
      // eliminado (docs/12 §B.6): cae al default del sitio.
      if (s.editingLocale === locale) s.editingLocale = i18n.defaultLocale;
    }),

  setDefaultLocale: (locale) =>
    set((s) => {
      const i18n = s.site.meta.i18n;
      if (!i18n || !i18n.locales.includes(locale)) return;
      i18n.defaultLocale = locale;
      // Invariante (docs/12 §B.4): defaultLocale === site.meta.defaultLang,
      // porque `props` siempre está en el idioma default del sitio.
      s.site.meta.defaultLang = locale;
    }),
});
