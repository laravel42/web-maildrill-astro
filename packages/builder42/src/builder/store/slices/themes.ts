/**
 * Sistema de temas (docs/11 §2-3, Fase 9.3). Los temas viven en
 * `site.meta.themes` (parte del sitio, NO del historial de zundo — igual que
 * los tokens). El `activeThemeId` es UI-state de preview.
 */
import { uniqueThemeId } from "../../model/theme";
import { getThemePreset } from "../../model/themePresets";
import { getLayoutThemePreset, type LayoutThemePreset } from "../../registry/layoutThemePresets";
import type { DesignTokens, PageId, StyleValue, Theme, ThemeId } from "../../model/types";
import { initialSite } from "./core";
import type { SliceCreator } from "./types";

export interface ThemesSlice {
  /**
   * Tema activo en el editor para PREVIEW en el canvas (docs/11 §6, Fase 9.3).
   * UI-state (no entra a zundo ni se serializa), análogo a `activeBreakpoint`/
   * `editingLocale`: define qué tema pinta el canvas vía `data-theme` en el
   * frame. `null` = sin tema (usa el `:root` base). Default = el tema por
   * defecto del sitio (`site.meta.defaultThemeId`).
   */
  activeThemeId: ThemeId | null;

  /** Cambia el tema previsualizado en el canvas (`null` = sin tema). */
  setActiveTheme: (themeId: ThemeId | null) => void;
  /** Crea un tema nuevo (id único, `tokens` vacío) y devuelve su id. */
  addTheme: (meta?: { name?: string; extends?: ThemeId; colorScheme?: "light" | "dark" }) => ThemeId;
  /** Crea un tema desde un preset de la galería (docs/11 §9.5) y lo activa. */
  applyThemePreset: (presetId: string) => ThemeId | null;
  /**
   * Crea (o actualiza, si ya se aplicó antes) un tema desde un preset de
   * PLANTILLA (docs/48 §3, `registry/layoutThemePresets.ts`) y lo activa.
   * Además de los tokens de color, registra las `fontFamilies` del preset
   * como tokens del sitio (mismo paso que `applyPageLayout`, docs/48 §3.2) —
   * sin esto la tipografía de la plantilla no viajaría al `<link>` de Google
   * Fonts del sitio exportado. Idempotente: el id del tema es determinista
   * (`layoutThemeId`), así que reaplicar el mismo preset actualiza ESE tema
   * en vez de acumular duplicados — igual que al reaplicar la plantilla
   * completa.
   */
  applyLayoutThemePreset: (presetId: string) => ThemeId | null;
  /** Borra un tema y limpia referencias (default/activo/páginas/`extends`). */
  removeTheme: (themeId: ThemeId) => void;
  /** Actualiza metadata del tema (nombre, herencia, esquema de color). */
  updateThemeMeta: (
    themeId: ThemeId,
    patch: { name?: string; extends?: ThemeId | null; colorScheme?: "light" | "dark" | null },
  ) => void;
  /** Escribe/remapea un token del tema por ruta (`colors.primary`, …). */
  setThemeToken: (themeId: ThemeId, path: string, value: StyleValue) => void;
  /** Quita un remapeo de token del tema (vuelve a heredar del base). */
  removeThemeToken: (themeId: ThemeId, path: string) => void;
  /** Marca el tema por defecto del sitio. */
  setDefaultTheme: (themeId: ThemeId) => void;
  /** Asigna (o quita, con `undefined`) el tema de una página. */
  setPageTheme: (pageId: PageId, themeId: ThemeId | undefined) => void;
}

/**
 * Registra las `fontFamilies` de un preset de plantilla como tokens del sitio
 * (docs/48 §3.2, mismo paso que `registerLayoutFontFamilies` de
 * `slices/layouts.ts` para `applyPageLayout`). Additivo: si el usuario ya
 * tiene una familia con esa clave, la suya gana.
 */
function registerLayoutPresetFontFamilies(preset: LayoutThemePreset, tokens: DesignTokens): void {
  if (!preset.fontFamilies) return;
  const typography = (tokens.typography ??= {});
  const existing = (typography.families ??= {});
  for (const [key, family] of Object.entries(preset.fontFamilies)) {
    if (!existing[key]) existing[key] = structuredClone(family);
  }
}

export const createThemesSlice: SliceCreator<ThemesSlice> = (set, get) => ({
  activeThemeId: initialSite.meta.defaultThemeId ?? null,

  // --- Theme system (docs/11 §2-3) ------------------------------------
  setActiveTheme: (themeId) => set({ activeThemeId: themeId }),

  addTheme: (meta) => {
    const id = uniqueThemeId(get().site.meta.themes);
    set((s) => {
      const themes = (s.site.meta.themes ??= {});
      const theme: Theme = {
        id,
        name: meta?.name?.trim() || id,
        tokens: {},
      };
      if (meta?.extends) theme.extends = meta.extends;
      if (meta?.colorScheme) theme.colorScheme = meta.colorScheme;
      themes[id] = theme;
      // El primer tema creado se vuelve el default del sitio.
      if (s.site.meta.defaultThemeId === undefined) s.site.meta.defaultThemeId = id;
      if (s.activeThemeId === null) s.activeThemeId = id;
    });
    return id;
  },

  applyThemePreset: (presetId) => {
    const preset = getThemePreset(presetId);
    if (!preset) return null;
    const id = uniqueThemeId(get().site.meta.themes);
    set((s) => {
      const themes = (s.site.meta.themes ??= {});
      const theme: Theme = { id, name: preset.name, tokens: { ...preset.tokens } };
      if (preset.colorScheme) theme.colorScheme = preset.colorScheme;
      themes[id] = theme;
      if (s.site.meta.defaultThemeId === undefined) s.site.meta.defaultThemeId = id;
      s.activeThemeId = id;
    });
    return id;
  },

  applyLayoutThemePreset: (presetId) => {
    const preset = getLayoutThemePreset(presetId);
    if (!preset) return null;
    const id = preset.themeId;
    set((s) => {
      const themes = (s.site.meta.themes ??= {});
      const theme: Theme = { id, name: preset.name, tokens: { ...preset.tokens } as Record<string, StyleValue> };
      if (preset.colorScheme) theme.colorScheme = preset.colorScheme;
      themes[id] = theme;
      registerLayoutPresetFontFamilies(preset, s.site.meta.tokens ?? (s.site.meta.tokens = {}));
      if (s.site.meta.defaultThemeId === undefined) s.site.meta.defaultThemeId = id;
      s.activeThemeId = id;
    });
    return id;
  },

  removeTheme: (themeId) =>
    set((s) => {
      const themes = s.site.meta.themes;
      if (!themes || !themes[themeId]) return;
      delete themes[themeId];
      // Limpiar toda referencia colgante (docs/11 §2).
      for (const other of Object.values(themes)) {
        if (other.extends === themeId) delete other.extends;
      }
      if (s.site.meta.defaultThemeId === themeId) {
        const remaining = Object.keys(themes);
        s.site.meta.defaultThemeId = remaining[0] ?? undefined;
      }
      if (s.activeThemeId === themeId) {
        s.activeThemeId = s.site.meta.defaultThemeId ?? null;
      }
      for (const page of Object.values(s.site.pages)) {
        if (page.meta.themeId === themeId) delete page.meta.themeId;
      }
    }),

  updateThemeMeta: (themeId, patch) =>
    set((s) => {
      const theme = s.site.meta.themes?.[themeId];
      if (!theme) return;
      if (patch.name !== undefined) theme.name = patch.name;
      if (patch.extends !== undefined) {
        // Evita auto-referencia directa (el resto de ciclos los tolera la
        // resolución pura, model/theme.ts).
        if (patch.extends === null || patch.extends === themeId) delete theme.extends;
        else theme.extends = patch.extends;
      }
      if (patch.colorScheme !== undefined) {
        if (patch.colorScheme === null) delete theme.colorScheme;
        else theme.colorScheme = patch.colorScheme;
      }
    }),

  setThemeToken: (themeId, path, value) =>
    set((s) => {
      const theme = s.site.meta.themes?.[themeId];
      if (!theme) return;
      (theme.tokens as Record<string, StyleValue>)[path] = value;
    }),

  removeThemeToken: (themeId, path) =>
    set((s) => {
      const theme = s.site.meta.themes?.[themeId];
      if (theme) delete (theme.tokens as Record<string, StyleValue>)[path];
    }),

  setDefaultTheme: (themeId) =>
    set((s) => {
      if (s.site.meta.themes?.[themeId]) s.site.meta.defaultThemeId = themeId;
    }),

  setPageTheme: (pageId, themeId) =>
    set((s) => {
      const page = s.site.pages[pageId];
      if (!page) return;
      if (themeId === undefined) delete page.meta.themeId;
      else page.meta.themeId = themeId;
    }),
});
