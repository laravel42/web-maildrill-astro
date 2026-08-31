/**
 * Slice de plantillas de página (Fase 13, docs/16 §13 + docs/32 Fase 3).
 * Reemplaza el documento de la página activa con una plantilla registrada.
 */
import { validateFragment } from "../../model/validate";
import { layoutThemeId, loadPageLayout, getPageLayout } from "../../registry/layoutRegistry";
import type { LayoutTheme } from "../../registry/layoutRegistry";
import type { StyleValue, Theme, TokenFontFamily } from "../../model/types";
import type { SliceCreator } from "./types";

export interface LayoutsSlice {
  /**
   * Aplica una plantilla de página: reemplaza el documento activo (con undo vía
   * zundo).
   *
   * Es **asíncrona** porque el fragmento de una plantilla de página se carga de
   * forma perezosa (docs/48 §4). El único punto de llamada es el modal de
   * confirmación del panel "Plantillas", que ya es un punto de espera natural;
   * la escritura al store sigue siendo un **único** `set`, así que el undo de
   * zundo no cambia. No-op silencioso si el id no es una plantilla de página, si
   * el módulo falla al cargar o si el fragmento no valida.
   */
  applyPageLayout: (layoutId: string) => Promise<void>;
}

/**
 * Registra las familias tipográficas de la plantilla como **tokens del sitio**
 * (docs/48 §3.2): es la única vía por la que la webfont llega al `<link>` de
 * Google Fonts del sitio exportado (`export/usage.ts` → `fontLinks`). Additivo:
 * si el usuario ya tiene una familia con esa clave, la suya gana (no le
 * cambiamos la tipografía de debajo de los pies).
 */
function registerLayoutFontFamilies(
  families: Record<string, TokenFontFamily> | undefined,
  tokens: { typography?: { families?: Record<string, TokenFontFamily> } },
): void {
  if (!families) return;
  const typography = (tokens.typography ??= {});
  const existing = (typography.families ??= {});
  for (const [key, family] of Object.entries(families)) {
    if (!existing[key]) existing[key] = structuredClone(family);
  }
}

/**
 * Registra (o actualiza) el tema de la plantilla y lo devuelve. Idempotente: el
 * id es determinista (`layoutThemeId`), así que reaplicar la plantilla no
 * acumula temas duplicados. NO toca `site.meta.defaultThemeId` — el tema por
 * defecto del sitio es del usuario (docs/48 §3.1, decisión D2).
 */
function registerLayoutTheme(
  layoutTheme: LayoutTheme,
  themes: Record<string, Theme>,
): string {
  const id = layoutThemeId(layoutTheme);
  const theme: Theme = {
    id,
    name: layoutTheme.name,
    tokens: { ...layoutTheme.tokens } as Record<string, StyleValue>,
  };
  if (layoutTheme.colorScheme) theme.colorScheme = layoutTheme.colorScheme;
  themes[id] = theme;
  return id;
}

export const createLayoutsSlice: SliceCreator<LayoutsSlice> = (set) => ({
  applyPageLayout: async (layoutId) => {
    const loaded = await loadPageLayout(layoutId);
    if (!loaded) return;
    const { fragment, pageMeta } = loaded;

    const validation = validateFragment(fragment);
    if (!validation.ok) {
      if (import.meta.env.DEV) {
        console.warn("[applyPageLayout] validation failed:", validation.errors);
      }
      return;
    }

    // La metadata eager (locales, tema) se lee del registry; el fragmento y el
    // `pageMeta` vienen del módulo perezoso que se acaba de cargar.
    const layout = getPageLayout(layoutId)!;

    set((draft) => {
      const page = draft.site.pages[draft.activePageId];
      if (!page) return;

      // Multilenguaje declarado por la plantilla (docs/42): sin `meta.i18n` el
      // `language-nav` del fragmento no recibe `ctx.localeInfo` y las
      // `translations` que trae quedarían inertes. Additivo y no destructivo.
      const declared = (layout.siteLocales ?? [])
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l !== "");
      if (declared.length > 0) {
        const meta = draft.site.meta;
        if (!meta.i18n) {
          meta.i18n = {
            locales: [...new Set([meta.defaultLang, ...declared])],
            defaultLocale: meta.defaultLang,
            routeStrategy: "prefix-except-default",
          };
        } else {
          for (const locale of declared) {
            if (!meta.i18n.locales.includes(locale)) meta.i18n.locales.push(locale);
          }
        }
      }

      // Metadata SEO de la plantilla (docs/42 §2.8): título/descripción/`seo` y
      // sus traducciones. Se conservan `slug` y `lang` — son de la página del
      // usuario, no de la plantilla. `themeId` también, salvo que la plantilla
      // traiga `theme` propio (docs/48 §3, bloque de abajo).
      if (pageMeta) {
        page.meta.title = pageMeta.title;
        if (pageMeta.description !== undefined) {
          page.meta.description = pageMeta.description;
        }
        if (pageMeta.seo !== undefined) {
          page.meta.seo = structuredClone(pageMeta.seo);
        }
        if (pageMeta.metaTranslations !== undefined) {
          page.meta.metaTranslations = structuredClone(pageMeta.metaTranslations);
        }
      }

      // Tema propio de la plantilla (docs/48 §3): personalidad de color y
      // tipografía. Se asigna a la PÁGINA, no al sitio, y se activa en el
      // canvas para que el usuario lo vea aplicado al instante. Todo additivo.
      if (layout.theme) {
        registerLayoutFontFamilies(layout.theme.fontFamilies, (draft.site.meta.tokens ??= {}));
        const themeId = registerLayoutTheme(layout.theme, (draft.site.meta.themes ??= {}));
        page.meta.themeId = themeId;
        draft.activeThemeId = themeId;
      }

      draft.document = {
        rootId: fragment.rootId,
        meta: { version: 1 },
        nodes: structuredClone(fragment.nodes),
      };
      page.translations = fragment.translations
        ? structuredClone(fragment.translations)
        : {};

      draft.selectedId = null;
      draft.editingTextNodeId = null;
      draft.activeTiptapEditor = null;
      draft.editingModalId = null;
      draft.pickInsert = null;
      draft.activeSlotByComposite = {};
      draft.previewStateBySelectedId = {};
    });
  },
});
